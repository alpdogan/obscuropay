const SENSITIVE_KEY =
  /secret|password|passwd|token|authorization|cookie|kek|private|seed|mnemonic|bot_token|webhook_secret|wallet|payer|chat_id|telegram/i;

const SECRETISH = /(?:sk_|whsec_|Bearer\s+)[A-Za-z0-9._\-]+/g;

export function newRequestId(): string {
  return `req_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function isSensitiveLogKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

export function redactText(value: string): string {
  return value.replace(SECRETISH, "[redacted]");
}

export function redactLogValue(key: string, value: unknown): unknown {
  if (isSensitiveLogKey(key)) {
    return "[redacted]";
  }
  if (typeof value === "string") {
    return redactText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(key, item));
  }
  if (value && typeof value === "object") {
    return redactLogRecord(value as Record<string, unknown>);
  }
  return value;
}

export function redactLogRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = redactLogValue(key, value);
  }
  return out;
}

export function structuredLog(record: Record<string, unknown>): string {
  return JSON.stringify(redactLogRecord({ ts: new Date().toISOString(), ...record }));
}
