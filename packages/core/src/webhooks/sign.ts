import { badRequest } from "../errors.ts";

export const WEBHOOK_EVENTS = [
  "payment.created",
  "payment.confirmed",
  "invocation.started",
  "invocation.completed",
  "invocation.failed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
export const WEBHOOK_MAX_ATTEMPTS = 5;

export function parseWebhookEvents(value: unknown): WebhookEvent[] {
  if (value === undefined || value === null) {
    return [...WEBHOOK_EVENTS];
  }
  if (!Array.isArray(value) || value.some((item) => !WEBHOOK_EVENTS.includes(item as WebhookEvent))) {
    throw badRequest("invalid_webhook_events", "events must be a subset of the documented webhook events");
  }
  return value as WebhookEvent[];
}

export function nextWebhookAttemptAt(attemptCount: number, now: number): number | null {
  if (attemptCount >= WEBHOOK_MAX_ATTEMPTS) {
    return null;
  }
  const delays = [0, 60, 300, 900, 3600];
  return now + (delays[attemptCount] ?? 3600);
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signWebhook(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return `sha256=${bytesToHex(signature)}`;
}

export function webhookSecretsEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyWebhookSignature(input: {
  secret: string;
  timestamp: string;
  body: string;
  signature: string;
  now: number;
}): Promise<boolean> {
  const ts = Number(input.timestamp);
  if (!Number.isInteger(ts) || Math.abs(input.now - ts) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }
  const expected = await signWebhook(input.secret, input.timestamp, input.body);
  return webhookSecretsEqual(expected, input.signature);
}

const WALLET_KEYS = /wallet|payer|tx_hash|^address$/i;

export function assertWebhookPayloadSafe(payload: Record<string, unknown>): void {
  for (const key of Object.keys(payload)) {
    if (WALLET_KEYS.test(key)) {
      throw badRequest("wallet_in_webhook", "Webhook payloads must not include wallet identity by default");
    }
  }
}

export function buildWebhookPayload(input: {
  id: string;
  event: WebhookEvent;
  paymentId?: string | null;
  invocationId?: string | null;
  endpoint?: string | null;
  amount?: string | null;
  asset?: string | null;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: input.id,
    event: input.event,
  };
  if (input.paymentId) {
    payload.payment_id = input.paymentId;
  }
  if (input.invocationId) {
    payload.invocation_id = input.invocationId;
  }
  if (input.endpoint) {
    payload.endpoint = input.endpoint;
  }
  if (input.amount) {
    payload.amount = input.amount;
  }
  if (input.asset) {
    payload.asset = input.asset;
  }
  assertWebhookPayloadSafe(payload);
  return payload;
}
