import {
  AesGcmSecretBox,
  WEBHOOK_MAX_ATTEMPTS,
  badRequest,
  buildWebhookPayload,
  inspectUrl,
  newId,
  nextWebhookAttemptAt,
  signWebhook,
  type WebhookEvent,
} from "@obscurus/core";
import { nowSeconds } from "../clock.ts";
import { findSecret } from "../repos/secrets.ts";
import {
  insertWebhookDelivery,
  listWebhookEndpointsByProject,
  updateWebhookDelivery,
} from "../repos/webhooks.ts";
import type { WebhookDeliveryRow, WebhookEndpointRow } from "../repos/types.ts";
import { isProduction } from "../runtime.ts";

export async function emitMerchantWebhooks(
  env: Env,
  input: {
    merchantId: string;
    projectId: string;
    event: WebhookEvent;
    paymentId?: string | null;
    invocationId?: string | null;
    endpoint?: string | null;
    amount?: string | null;
    asset?: string | null;
  },
): Promise<void> {
  const hooks = await listWebhookEndpointsByProject(env.DB, input.merchantId, input.projectId);
  for (const hook of hooks) {
    const events = JSON.parse(hook.events_json) as WebhookEvent[];
    if (!events.includes(input.event)) {
      continue;
    }
    const deliveryId = newId("delivery");
    const payload = buildWebhookPayload({
      id: deliveryId,
      event: input.event,
      paymentId: input.paymentId,
      invocationId: input.invocationId,
      endpoint: input.endpoint,
      amount: input.amount,
      asset: input.asset,
    });
    const now = nowSeconds();
    const row: WebhookDeliveryRow = {
      id: deliveryId,
      merchant_id: input.merchantId,
      webhook_id: hook.id,
      event: input.event,
      payload_json: JSON.stringify(payload),
      status: "pending",
      attempt_count: 0,
      last_http_status: null,
      last_error: null,
      next_attempt_at: now,
      created_at: now,
      updated_at: now,
    };
    await insertWebhookDelivery(env.DB, row);
    await attemptWebhookDelivery(env, hook, row);
  }
}

export async function attemptWebhookDelivery(
  env: Env,
  hook: WebhookEndpointRow,
  row: WebhookDeliveryRow,
): Promise<WebhookDeliveryRow> {
  const now = nowSeconds();
  const secret = await findSecret(env.DB, hook.merchant_id, hook.secret_id);
  if (!secret) {
    const failed = {
      ...row,
      status: "dead",
      last_error: "secret_missing",
      attempt_count: row.attempt_count + 1,
      updated_at: now,
      next_attempt_at: null,
    };
    await updateWebhookDelivery(env.DB, failed);
    return failed;
  }
  const token = await AesGcmSecretBox.fromBase64(env.SECRET_KEK).decrypt(secret.ciphertext);
  const timestamp = String(now);
  const signature = await signWebhook(token, timestamp, row.payload_json);
  let status = 0;
  let error: string | null = null;
  if (env.WEBHOOK_STUB === "1") {
    const delivered = {
      ...row,
      attempt_count: row.attempt_count + 1,
      last_http_status: 200,
      last_error: null,
      status: "delivered",
      next_attempt_at: null,
      updated_at: now,
    };
    await updateWebhookDelivery(env.DB, delivered);
    return delivered;
  }
  try {
    const response = await fetch(hook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Obscurus-Signature": signature,
        "X-Obscurus-Timestamp": timestamp,
        "X-Obscurus-Event": row.event,
        "X-Obscurus-Delivery": row.id,
      },
      body: row.payload_json,
    });
    status = response.status;
    if (status < 200 || status >= 300) {
      error = `http_${status}`;
    }
  } catch {
    error = "delivery_failed";
  }
  const attemptCount = row.attempt_count + 1;
  const delivered = error === null;
  const next = nextWebhookAttemptAt(attemptCount, now);
  const nextRow: WebhookDeliveryRow = {
    ...row,
    attempt_count: attemptCount,
    last_http_status: status || null,
    last_error: error,
    status: delivered ? "delivered" : next === null || attemptCount >= WEBHOOK_MAX_ATTEMPTS ? "dead" : "failed",
    next_attempt_at: delivered ? null : next,
    updated_at: now,
  };
  await updateWebhookDelivery(env.DB, nextRow);
  return nextRow;
}

export function assertWebhookUrl(url: string, env: Env): string {
  const inspected = inspectUrl(url, { allowHttp: !isProduction(env) });
  if (!inspected.ok) {
    throw badRequest("invalid_webhook_url", `Webhook URL is not allowed (${inspected.reason})`);
  }
  return inspected.url.toString();
}
