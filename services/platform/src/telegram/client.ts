import { badRequest } from "@obscurus/core";

const TELEGRAM_API = "https://api.telegram.org";
const TOKEN_RE = /^\d+:[A-Za-z0-9_-]+$/;

export function assertTelegramToken(token: string): string {
  const value = token.trim();
  if (!TOKEN_RE.test(value) || value.length > 200) {
    throw badRequest("invalid_telegram_token", "Bot token must look like 123456:AAH...");
  }
  return value;
}

function telegramMethodUrl(token: string, method: string): string {
  if (!/^[a-zA-Z]+$/.test(method)) {
    throw new Error("invalid_telegram_method");
  }
  return `${TELEGRAM_API}/bot${token}/${method}`;
}

export async function callTelegram(
  env: Env,
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  if (env.TELEGRAM_STUB === "1") {
    return true;
  }
  try {
    const response = await fetch(telegramMethodUrl(token, method), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendTelegramMessage(
  env: Env,
  token: string,
  chatId: string,
  text: string,
  button?: { label: string; url: string },
): Promise<boolean> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (button) {
    body.reply_markup = {
      inline_keyboard: [[{ text: button.label, url: button.url }]],
    };
  }
  return callTelegram(env, token, "sendMessage", body);
}

export async function registerTelegramWebhook(
  env: Env,
  token: string,
  url: string,
  secret: string,
): Promise<boolean> {
  return callTelegram(env, token, "setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message"],
  });
}
