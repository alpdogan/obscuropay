import { AesGcmSecretBox } from "@obscurus/core";
import { nowSeconds } from "../clock.ts";
import type { InvocationRow } from "../repos/types.ts";
import { findSecret } from "../repos/secrets.ts";
import { findTelegramIntegrationById, findTelegramSession, markTelegramDelivered } from "../repos/telegram.ts";
import { sendTelegramMessage } from "./client.ts";
import { resultTelegramText } from "./messages.ts";

export async function deliverTelegramIfNeeded(
  env: Env,
  invocation: InvocationRow,
): Promise<{ delivered: boolean } | null> {
  const session = await findTelegramSession(env.DB, invocation.id);
  if (!session) {
    return null;
  }
  if (session.delivered_at) {
    return { delivered: true };
  }
  if (invocation.status !== "FULFILLED" && invocation.status !== "FAILED") {
    return { delivered: false };
  }
  const integration = await findTelegramIntegrationById(env.DB, session.integration_id);
  const secret = integration ? await findSecret(env.DB, integration.merchant_id, integration.secret_id) : null;
  if (!integration || !secret) {
    return { delivered: false };
  }
  const token = await AesGcmSecretBox.fromBase64(env.SECRET_KEK).decrypt(secret.ciphertext);
  const text =
    invocation.status === "FAILED"
      ? "Payment succeeded, but the merchant API failed. The charge was not automatically refunded."
      : resultTelegramText(invocation.output_preview);
  const sent = await sendTelegramMessage(env, token, session.chat_id, text);
  if (sent) {
    await markTelegramDelivered(env.DB, invocation.id, nowSeconds());
  }
  return { delivered: sent };
}
