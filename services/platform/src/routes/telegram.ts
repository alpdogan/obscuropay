import {
  AesGcmSecretBox,
  DomainError,
  badRequest,
  formatTelegramCommand,
  mapTelegramArgument,
  newId,
  normalizeTelegramCommand,
  parseInputSchema,
  parseTelegramMapping,
  parseTelegramText,
  secretHint,
  unauthorized,
} from "@obscurus/core";
import { Hono } from "hono";
import { requireMerchant } from "../auth.ts";
import { nowSeconds } from "../clock.ts";
import { readJson } from "../http/json.ts";
import { startPaidInvocation } from "../payment-service.ts";
import { presentPayment } from "../presenters.ts";
import { findEndpoint } from "../repos/endpoints.ts";
import { findProject } from "../repos/projects.ts";
import { findSecret, insertSecret, updateSecretCipher } from "../repos/secrets.ts";
import {
  findTelegramByCommand,
  findTelegramIntegrationById,
  insertTelegramIntegration,
  insertTelegramSession,
  listTelegramIntegrations,
  updateTelegramIntegration,
} from "../repos/telegram.ts";
import type { TelegramIntegrationRow } from "../repos/types.ts";
import { assertTelegramToken, registerTelegramWebhook, sendTelegramMessage } from "../telegram/client.ts";
import { checkoutPayUrl, publicOrigin } from "../telegram/origin.ts";
import { paymentRequiredTelegramText, unknownCommandTelegramText } from "../telegram/messages.ts";
import { secretsEqual } from "../telegram/secrets-eq.ts";
import { isProduction } from "../runtime.ts";

export const telegramMerchantRoutes = new Hono<{ Bindings: Env; Variables: { merchantId: string } }>();
export const telegramWebhookRoutes = new Hono<{ Bindings: Env }>();

telegramMerchantRoutes.use("*", requireMerchant);

function presentTelegram(row: TelegramIntegrationRow, hint: string, webhookUrl: string) {
  return {
    id: row.id,
    project_id: row.project_id,
    endpoint_id: row.endpoint_id,
    command: formatTelegramCommand(row.command),
    input_field: row.input_field,
    token_hint: hint,
    webhook_url: webhookUrl,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function webhookUrlFor(env: Env, requestUrl: string, id: string): string {
  return `${publicOrigin(env, requestUrl)}/v1/telegram/webhook/${id}`;
}

async function tokenHint(env: Env, row: TelegramIntegrationRow): Promise<string> {
  const secret = await findSecret(env.DB, row.merchant_id, row.secret_id);
  return secret?.hint ?? "••••";
}

telegramMerchantRoutes.get("/", async (c) => {
  const rows = await listTelegramIntegrations(c.env.DB, c.get("merchantId"));
  const integrations = [];
  for (const row of rows) {
    integrations.push(
      presentTelegram(row, await tokenHint(c.env, row), webhookUrlFor(c.env, c.req.url, row.id)),
    );
  }
  return c.json({ integrations });
});

telegramMerchantRoutes.post("/", async (c) => {
  const body = await readJson<{
    project_id?: string;
    endpoint_id?: string;
    command?: string;
    input_field?: string;
    mapping?: string;
    bot_token?: string;
  }>(c.req.raw);
  const project = await findProject(c.env.DB, c.get("merchantId"), body.project_id ?? "");
  if (!project) {
    throw badRequest("invalid_project", "project_id is required");
  }
  const endpoint = await findEndpoint(c.env.DB, c.get("merchantId"), body.endpoint_id ?? "");
  if (!endpoint || endpoint.project_id !== project.id) {
    throw badRequest("invalid_endpoint", "endpoint_id must belong to the project");
  }
  const mapped = body.mapping ? parseTelegramMapping(body.mapping) : null;
  const command = normalizeTelegramCommand(body.command ?? mapped?.command ?? "");
  const inputField = body.input_field?.trim() || mapped?.field || null;
  const token = assertTelegramToken(body.bot_token ?? "");
  const now = nowSeconds();
  const box = AesGcmSecretBox.fromBase64(c.env.SECRET_KEK);
  const existing = await findTelegramByCommand(c.env.DB, c.get("merchantId"), command);
  const ciphertext = await box.encrypt(token);
  const hint = secretHint(token);
  let row: TelegramIntegrationRow;
  if (existing) {
    await updateSecretCipher(c.env.DB, {
      id: existing.secret_id,
      merchantId: existing.merchant_id,
      ciphertext,
      hint,
    });
    row = {
      ...existing,
      project_id: project.id,
      endpoint_id: endpoint.id,
      input_field: inputField,
      updated_at: now,
    };
    await updateTelegramIntegration(c.env.DB, row);
  } else {
    const secretId = newId("secret");
    await insertSecret(c.env.DB, {
      id: secretId,
      merchantId: c.get("merchantId"),
      projectId: project.id,
      name: `telegram_bot_${command}`,
      ciphertext,
      hint,
      now,
    });
    row = {
      id: newId("telegram"),
      merchant_id: c.get("merchantId"),
      project_id: project.id,
      endpoint_id: endpoint.id,
      command,
      input_field: inputField,
      secret_id: secretId,
      webhook_secret: crypto.randomUUID().replaceAll("-", ""),
      created_at: now,
      updated_at: now,
    };
    await insertTelegramIntegration(c.env.DB, row);
  }
  const webhookUrl = webhookUrlFor(c.env, c.req.url, row.id);
  await registerTelegramWebhook(c.env, token, webhookUrl, row.webhook_secret);
  return c.json(
    { integration: { ...presentTelegram(row, hint, webhookUrl), webhook_secret: row.webhook_secret } },
    existing ? 200 : 201,
  );
});

function extractTelegramMessage(update: unknown): { chatId: string; text: string } | null {
  if (!update || typeof update !== "object") {
    return null;
  }
  const message = (update as { message?: { chat?: { id?: unknown }; text?: unknown } }).message;
  if (!message || typeof message.text !== "string" || message.chat?.id === undefined) {
    return null;
  }
  return { chatId: String(message.chat.id), text: message.text };
}

telegramWebhookRoutes.post("/webhook/:id", async (c) => {
  const integration = await findTelegramIntegrationById(c.env.DB, c.req.param("id"));
  if (!integration) {
    throw unauthorized("Unknown Telegram integration");
  }
  const provided = c.req.header("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!secretsEqual(provided, integration.webhook_secret)) {
    throw unauthorized("Invalid Telegram webhook secret");
  }
  const update = await readJson<unknown>(c.req.raw);
  const message = extractTelegramMessage(update);
  if (!message) {
    return c.json({ ok: true });
  }
  const parsed = parseTelegramText(message.text);
  if (!parsed || parsed.command !== integration.command) {
    const secret = await findSecret(c.env.DB, integration.merchant_id, integration.secret_id);
    if (secret) {
      const token = await AesGcmSecretBox.fromBase64(c.env.SECRET_KEK).decrypt(secret.ciphertext);
      await sendTelegramMessage(c.env, token, message.chatId, unknownCommandTelegramText(integration.command));
    }
    return c.json({ ok: true, obscurus: isProduction(c.env) ? undefined : { replied: "unknown_command" } });
  }

  try {
    const endpoint = await findEndpoint(c.env.DB, integration.merchant_id, integration.endpoint_id);
    if (!endpoint) {
      throw badRequest("invalid_endpoint", "Mapped endpoint is missing");
    }
    const input = mapTelegramArgument(
      parseInputSchema(JSON.parse(endpoint.input_schema_json)),
      parsed.argument,
      integration.input_field,
    );
    const started = await startPaidInvocation(c.env, endpoint.id, input, "telegram");
    await insertTelegramSession(c.env.DB, {
      invocation_id: started.invocation.id,
      merchant_id: integration.merchant_id,
      integration_id: integration.id,
      chat_id: message.chatId,
      delivered_at: null,
      created_at: nowSeconds(),
    });
    const secret = await findSecret(c.env.DB, integration.merchant_id, integration.secret_id);
    const token = secret ? await AesGcmSecretBox.fromBase64(c.env.SECRET_KEK).decrypt(secret.ciphertext) : "";
    const payUrl = checkoutPayUrl(c.env, started.payment.id);
    if (token) {
      await sendTelegramMessage(
        c.env,
        token,
        message.chatId,
        paymentRequiredTelegramText(started.payment.amount, started.payment.asset),
        { label: `Pay ${started.payment.amount} ${started.payment.asset}`, url: payUrl },
      );
    }
    return c.json({
      ok: true,
      obscurus: isProduction(c.env)
        ? undefined
        : {
            replied: "payment_required",
            invocation_id: started.invocation.id,
            checkout_url: presentPayment(started.payment).checkout_url,
            pay_url: payUrl,
          },
    });
  } catch (error) {
    if (error instanceof DomainError && error.status === 400) {
      const secret = await findSecret(c.env.DB, integration.merchant_id, integration.secret_id);
      if (secret) {
        const token = await AesGcmSecretBox.fromBase64(c.env.SECRET_KEK).decrypt(secret.ciphertext);
        await sendTelegramMessage(c.env, token, message.chatId, error.message);
      }
      return c.json({ ok: true, obscurus: isProduction(c.env) ? undefined : { replied: "invalid_input" } });
    }
    throw error;
  }
});
