import {
  applyVerification,
  assertImplementedPricing,
  beginFulfillment,
  canIssueEntitlement,
  claimEntitlement,
  completeFulfillment,
  conflict,
  createPerRequestEntitlement,
  expirePayment,
  isExpired,
  newId,
  newPaymentRef,
  notFound,
  openPayment,
  parseInputSchema,
  parsePricingType,
  requirePaidForFulfill,
  validateInput,
  type Entitlement,
  type PaymentRecord,
  type PaymentState,
} from "@obscurus/core";
import { nowSeconds } from "./clock.ts";
import { executeStoredEndpoint } from "./execute-endpoint.ts";
import { findEntitlementByPayment, insertEntitlement, updateEntitlement } from "./repos/entitlements.ts";
import { findEndpointById } from "./repos/endpoints.ts";
import { findInvocationById, insertInvocation, updateInvocation } from "./repos/invocations.ts";
import { findPaymentById, insertPayment, updatePayment } from "./repos/payments.ts";
import type { EntitlementRow, EndpointRow, InvocationRow, PaymentRow } from "./repos/types.ts";

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
    provider: "mock",
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
  if (isExpired(record, now)) {
    record = expirePayment(record);
  } else {
    const matched = payment.mock_ready === 1 || record.state === "PAID" || record.state === "FULFILLING" || record.state === "FULFILLED";
    record = applyVerification(record, { matched, state: matched ? "PAID" : record.state }, now);
  }
  const next = applyRecord(payment, record, now);
  await updatePayment(env.DB, next);

  if (next.state === "EXPIRED" && payment.invocation_id) {
    const invocation = await findInvocationById(env.DB, payment.invocation_id);
    if (invocation && invocation.status === "AWAITING_PAYMENT") {
      await updateInvocation(env.DB, { ...invocation, status: "FAILED", error_class: "payment_expired", completed_at: now });
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
    return { payment: fulfilled, invocation: executed };
  }
  return { payment, invocation: executed };
}
