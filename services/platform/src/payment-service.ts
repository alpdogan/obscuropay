import {
  applyVerification,
  assertImplementedPricing,
  beginFulfillment,
  canIssueEntitlement,
  claimEntitlement,
  completeFulfillment,
  conflict,
  createPerRequestEntitlement,
  amountToTokenUnits,
  expirePayment,
  failPayment,
  isExpired,
  newId,
  newPaymentRef,
  notFound,
  openPayment,
  paymentRefToBytes32,
  parseInputSchema,
  parsePricingType,
  requirePaidForFulfill,
  validateInput,
  type Entitlement,
  type PaymentRecord,
  type PaymentState,
} from "@obscurus/core";
import { chainSettings, developmentMockMatched, fetchPaymentLogs, matchPaymentLogs } from "./chain/payment-log.ts";
import { nowSeconds } from "./clock.ts";
import { executeStoredEndpoint } from "./execute-endpoint.ts";
import { findEntitlementByPayment, insertEntitlement, updateEntitlement } from "./repos/entitlements.ts";
import { findEndpointById } from "./repos/endpoints.ts";
import { findInvocationById, insertInvocation, updateInvocation } from "./repos/invocations.ts";
import { findMerchantById } from "./repos/merchants.ts";
import { insertPayment, updatePayment } from "./repos/payments.ts";
import { isProduction } from "./runtime.ts";
import type { EntitlementRow, EndpointRow, InvocationRow, PaymentRow } from "./repos/types.ts";
import { emitMerchantWebhooks } from "./webhooks/dispatch.ts";

async function safeEmit(
  env: Env,
  input: Parameters<typeof emitMerchantWebhooks>[1],
): Promise<void> {
  try {
    await emitMerchantWebhooks(env, input);
  } catch {
    // Delivery failures must not roll back payment truth.
  }
}

const PAYMENT_TTL_SECONDS = 30 * 60;

export function toPaymentRecord(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    endpointId: row.endpoint_id ?? "",
    invocationId: row.invocation_id ?? "",
    amount: row.amount,
    asset: row.asset,
    state: row.state as PaymentState,
    paymentRef: row.payment_ref,
    provider: row.provider,
    expiresAt: row.expires_at,
  };
}

export function toEntitlement(row: EntitlementRow): Entitlement {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    endpointId: row.endpoint_id,
    invocationId: row.invocation_id,
    paymentId: row.payment_id,
    pricingType: "PER_REQUEST",
    status: row.status === "CLAIMED" ? "CLAIMED" : "UNUSED",
    claimedAt: row.claimed_at,
    createdAt: row.created_at,
  };
}

function applyRecord(row: PaymentRow, record: PaymentRecord, now: number): PaymentRow {
  return { ...row, state: record.state, expires_at: record.expiresAt ?? row.expires_at, updated_at: now };
}

export async function startPaidInvocation(
  env: Env,
  endpointId: string,
  rawInput: Record<string, unknown>,
  source = "http",
): Promise<{ endpoint: EndpointRow; invocation: InvocationRow; payment: PaymentRow }> {
  const endpoint = await findEndpointById(env.DB, endpointId);
  if (!endpoint) {
    throw notFound("endpoint");
  }
  assertImplementedPricing(parsePricingType(endpoint.pricing_type));
  const input = validateInput(parseInputSchema(JSON.parse(endpoint.input_schema_json)), rawInput);
  const now = nowSeconds();
  const invocation: InvocationRow = {
    id: newId("invocation"),
    merchant_id: endpoint.merchant_id,
    project_id: endpoint.project_id,
    endpoint_id: endpoint.id,
    source,
    status: "AWAITING_PAYMENT",
    input_json: JSON.stringify(input),
    output_preview: null,
    error_class: null,
    http_status: null,
    created_at: now,
    completed_at: null,
  };
  const opened = openPayment({
    id: newId("payment"),
    merchantId: endpoint.merchant_id,
    endpointId: endpoint.id,
    invocationId: invocation.id,
    amount: endpoint.price_amount,
    asset: endpoint.price_asset,
    state: "CREATED",
    paymentRef: newPaymentRef(),
    provider: chainSettings(env) ? "base-sepolia" : "mock",
    expiresAt: now + PAYMENT_TTL_SECONDS,
  });
  const payment: PaymentRow = {
    id: opened.id,
    merchant_id: endpoint.merchant_id,
    project_id: endpoint.project_id,
    endpoint_id: endpoint.id,
    invocation_id: invocation.id,
    amount: opened.amount,
    asset: opened.asset,
    state: opened.state,
    payment_ref: opened.paymentRef,
    provider: opened.provider,
    expires_at: opened.expiresAt ?? null,
    mock_ready: 0,
    created_at: now,
    updated_at: now,
  };
  await insertInvocation(env.DB, invocation);
  await insertPayment(env.DB, payment);
  await safeEmit(env, {
    merchantId: endpoint.merchant_id,
    projectId: endpoint.project_id,
    event: "payment.created",
    paymentId: payment.id,
    invocationId: invocation.id,
    endpoint: endpoint.slug,
    amount: payment.amount,
    asset: payment.asset,
  });
  await safeEmit(env, {
    merchantId: endpoint.merchant_id,
    projectId: endpoint.project_id,
    event: "invocation.started",
    paymentId: payment.id,
    invocationId: invocation.id,
    endpoint: endpoint.slug,
    amount: payment.amount,
    asset: payment.asset,
  });
  return { endpoint, invocation, payment };
}

export async function markMockComplete(env: Env, payment: PaymentRow): Promise<PaymentRow> {
  const now = nowSeconds();
  const next = { ...payment, mock_ready: 1, updated_at: now };
  await updatePayment(env.DB, next);
  return next;
}

export async function verifyStoredPayment(env: Env, payment: PaymentRow): Promise<{
  payment: PaymentRow;
  entitlement: EntitlementRow | null;
}> {
  const now = nowSeconds();
  let record = toPaymentRecord(payment);
  let chainMismatch = false;
  if (isExpired(record, now)) {
    record = expirePayment(record);
  } else if (payment.provider === "base-sepolia") {
    const chain = chainSettings(env);
    const merchant = await findMerchantById(env.DB, payment.merchant_id);
    if (!chain || !merchant?.settlement_address) {
      chainMismatch = false;
    } else {
      const logs = await fetchPaymentLogs(chain.rpcUrl, chain.contract, paymentRefToBytes32(payment.payment_ref));
      const match = matchPaymentLogs(logs, {
        contract: chain.contract,
        paymentRef: payment.payment_ref,
        merchant: merchant.settlement_address,
        asset: chain.usdc,
        amount: amountToTokenUnits(payment.amount),
      });
      if (match === "matched") {
        record = applyVerification(record, { matched: true, state: "PAID" }, now);
      } else if (match === "mismatch" && (record.state === "AWAITING_PAYMENT" || record.state === "CONFIRMING")) {
        chainMismatch = true;
        record = failPayment(record);
      }
    }
  } else if (
    developmentMockMatched({
      production: isProduction(env),
      provider: payment.provider,
      mockReady: payment.mock_ready,
    })
  ) {
    record = applyVerification(record, { matched: true, state: "PAID" }, now);
  }
  const next = applyRecord(payment, record, now);
  await updatePayment(env.DB, next);

  if ((next.state === "EXPIRED" || chainMismatch) && payment.invocation_id) {
    const invocation = await findInvocationById(env.DB, payment.invocation_id);
    if (invocation && invocation.status === "AWAITING_PAYMENT") {
      await updateInvocation(env.DB, {
        ...invocation,
        status: "FAILED",
        error_class: chainMismatch ? "payment_mismatch" : "payment_expired",
        completed_at: now,
      });
    }
  }

  let entitlement = await findEntitlementByPayment(env.DB, next.id);
  if (!entitlement && canIssueEntitlement(record) && next.endpoint_id && next.invocation_id) {
    const created = createPerRequestEntitlement({
      id: newId("entitlement"),
      merchantId: next.merchant_id,
      endpointId: next.endpoint_id,
      invocationId: next.invocation_id,
      paymentId: next.id,
      createdAt: now,
    });
    entitlement = {
      id: created.id,
      merchant_id: created.merchantId,
      endpoint_id: created.endpointId,
      invocation_id: created.invocationId,
      payment_id: created.paymentId,
      pricing_type: created.pricingType,
      status: created.status,
      claimed_at: created.claimedAt,
      created_at: created.createdAt,
    };
    try {
      await insertEntitlement(env.DB, entitlement);
    } catch {
      entitlement = await findEntitlementByPayment(env.DB, next.id);
    }
    const invocation = await findInvocationById(env.DB, next.invocation_id);
    if (invocation && invocation.status === "AWAITING_PAYMENT") {
      await updateInvocation(env.DB, { ...invocation, status: "PAID" });
    }
    const endpoint = next.endpoint_id ? await findEndpointById(env.DB, next.endpoint_id) : null;
    if (endpoint) {
      await safeEmit(env, {
        merchantId: next.merchant_id,
        projectId: endpoint.project_id,
        event: "payment.confirmed",
        paymentId: next.id,
        invocationId: next.invocation_id,
        endpoint: endpoint.slug,
        amount: next.amount,
        asset: next.asset,
      });
    }
  }
  return { payment: next, entitlement };
}

export async function fulfillStoredPayment(env: Env, payment: PaymentRow): Promise<{
  payment: PaymentRow;
  invocation: InvocationRow;
}> {
  const record = toPaymentRecord(payment);
  requirePaidForFulfill(record);
  if (!payment.endpoint_id || !payment.invocation_id) {
    throw conflict("payment_incomplete", "Payment is missing invocation references");
  }
  const endpoint = await findEndpointById(env.DB, payment.endpoint_id);
  const invocation = await findInvocationById(env.DB, payment.invocation_id);
  if (!endpoint || !invocation) {
    throw notFound("payment");
  }
  if (record.state === "FULFILLED" || invocation.status === "FULFILLED" || invocation.status === "FAILED") {
    return { payment, invocation };
  }

  const entitlementRow = await findEntitlementByPayment(env.DB, payment.id);
  if (!entitlementRow) {
    throw conflict("entitlement_missing", "Payment is not entitled yet");
  }
  const entitlement = toEntitlement(entitlementRow);
  if (entitlement.status === "CLAIMED") {
    return { payment, invocation };
  }

  const claimed = claimEntitlement(entitlement, nowSeconds());
  await updateEntitlement(env.DB, {
    ...entitlementRow,
    status: claimed.status,
    claimed_at: claimed.claimedAt,
  });

  const input = JSON.parse(invocation.input_json) as Record<string, unknown>;
  const executed = await executeStoredEndpoint(env, endpoint, { ...invocation, status: "FULFILLING" }, input);
  await updateInvocation(env.DB, executed);

  if (executed.status === "FULFILLED") {
    const fulfilled = applyRecord(payment, completeFulfillment(beginFulfillment(record)), nowSeconds());
    await updatePayment(env.DB, fulfilled);
    await safeEmit(env, {
      merchantId: endpoint.merchant_id,
      projectId: endpoint.project_id,
      event: "invocation.completed",
      paymentId: payment.id,
      invocationId: executed.id,
      endpoint: endpoint.slug,
      amount: payment.amount,
      asset: payment.asset,
    });
    return { payment: fulfilled, invocation: executed };
  }
  await safeEmit(env, {
    merchantId: endpoint.merchant_id,
    projectId: endpoint.project_id,
    event: "invocation.failed",
    paymentId: payment.id,
    invocationId: executed.id,
    endpoint: endpoint.slug,
    amount: payment.amount,
    asset: payment.asset,
  });
  return { payment, invocation: executed };
}
