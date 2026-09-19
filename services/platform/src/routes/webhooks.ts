import { AesGcmSecretBox, newId, notFound, parseWebhookEvents, secretHint, signWebhook } from "@obscurus/core";
import { Hono } from "hono";
import { requireMerchant } from "../auth.ts";
import { nowSeconds } from "../clock.ts";
import { readJson } from "../http/json.ts";
import { findProject } from "../repos/projects.ts";
import { findSecret, insertSecret } from "../repos/secrets.ts";
import {
  findWebhookDelivery,
  findWebhookEndpoint,
  insertWebhookEndpoint,
  latestWebhookDelivery,
  listWebhookDeliveries,
  listWebhookEndpoints,
} from "../repos/webhooks.ts";
import { attemptWebhookDelivery, assertWebhookUrl } from "../webhooks/dispatch.ts";

export const webhookRoutes = new Hono<{ Bindings: Env; Variables: { merchantId: string } }>();

webhookRoutes.use("*", requireMerchant);

function presentWebhook(
  row: { id: string; project_id: string; url: string; events_json: string; created_at: number },
  hint: string,
  health: { last_status: string | null; healthy: boolean },
  secret?: string,
) {
  return {
    id: row.id,
    project_id: row.project_id,
    url: row.url,
    events: JSON.parse(row.events_json) as string[],
    secret_hint: hint,
    ...(secret ? { secret } : {}),
    last_delivery_status: health.last_status,
    healthy: health.healthy,
    created_at: row.created_at,
  };
}

async function healthFor(env: Env, merchantId: string, webhookId: string) {
  const latest = await latestWebhookDelivery(env.DB, merchantId, webhookId);
  return { last_status: latest?.status ?? null, healthy: latest?.status === "delivered" || !latest };
}

webhookRoutes.get("/", async (c) => {
  const rows = await listWebhookEndpoints(c.env.DB, c.get("merchantId"));
  const webhooks = [];
  for (const row of rows) {
    const secret = await findSecret(c.env.DB, row.merchant_id, row.secret_id);
    webhooks.push(
      presentWebhook(row, secret?.hint ?? "••••", await healthFor(c.env, row.merchant_id, row.id)),
    );
  }
  return c.json({ webhooks });
});

webhookRoutes.post("/", async (c) => {
  const body = await readJson<{ project_id?: string; url?: string; events?: unknown }>(c.req.raw);
  const project = await findProject(c.env.DB, c.get("merchantId"), body.project_id ?? "");
  if (!project) {
    throw notFound("project");
  }
  const url = assertWebhookUrl(body.url ?? "", c.env);
  const events = parseWebhookEvents(body.events);
  const now = nowSeconds();
  const plaintext = `whsec_${crypto.randomUUID().replaceAll("-", "")}`;
  const box = AesGcmSecretBox.fromBase64(c.env.SECRET_KEK);
  const secretId = newId("secret");
  await insertSecret(c.env.DB, {
    id: secretId,
    merchantId: c.get("merchantId"),
    projectId: project.id,
    name: `webhook_${now}`,
    ciphertext: await box.encrypt(plaintext),
    hint: secretHint(plaintext),
    now,
  });
  const row = {
    id: newId("webhook"),
    merchant_id: c.get("merchantId"),
    project_id: project.id,
    url,
    secret_id: secretId,
    events_json: JSON.stringify(events),
    created_at: now,
    updated_at: now,
  };
  await insertWebhookEndpoint(c.env.DB, row);
  const exampleBody = JSON.stringify({ id: "whd_example", event: "payment.confirmed", amount: "0.50", asset: "USDC" });
  const timestamp = String(now);
  return c.json(
    {
      webhook: presentWebhook(row, secretHint(plaintext), { last_status: null, healthy: true }, plaintext),
      verify: {
        headers: {
          "X-Obscurus-Signature": await signWebhook(plaintext, timestamp, exampleBody),
          "X-Obscurus-Timestamp": timestamp,
        },
        message: "HMAC-SHA256 hex of `${timestamp}.${rawBody}`, prefixed with sha256=",
      },
    },
    201,
  );
});

webhookRoutes.get("/:id/deliveries", async (c) => {
  const hook = await findWebhookEndpoint(c.env.DB, c.get("merchantId"), c.req.param("id"));
  if (!hook) {
    throw notFound("webhook");
  }
  const rows = await listWebhookDeliveries(c.env.DB, c.get("merchantId"), hook.id);
  return c.json({
    deliveries: rows.map((row) => ({
      id: row.id,
      event: row.event,
      status: row.status,
      attempt_count: row.attempt_count,
      last_http_status: row.last_http_status,
      last_error: row.last_error,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      created_at: row.created_at,
    })),
  });
});

webhookRoutes.post("/deliveries/:id/retry", async (c) => {
  const row = await findWebhookDelivery(c.env.DB, c.get("merchantId"), c.req.param("id"));
  if (!row) {
    throw notFound("delivery");
  }
  const hook = await findWebhookEndpoint(c.env.DB, c.get("merchantId"), row.webhook_id);
  if (!hook) {
    throw notFound("webhook");
  }
  const retried = await attemptWebhookDelivery(c.env, hook, { ...row, attempt_count: Math.max(0, row.attempt_count - 1) });
  return c.json({
    delivery: {
      id: retried.id,
      event: retried.event,
      status: retried.status,
      attempt_count: retried.attempt_count,
    },
  });
});
