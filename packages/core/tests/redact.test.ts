import { describe, expect, it } from "vitest";
import { redactLogRecord, redactText, structuredLog } from "../src/observability/redact.ts";

describe("log redaction", () => {
  it("never keeps secrets, tokens, or wallets", () => {
    const redacted = redactLogRecord({
      request_id: "req_1",
      authorization: "Bearer SUPERSECRET",
      bot_token: "123456:AAHsecret",
      note: "header Bearer SUPERSECRET",
      wallet: "0xabc",
    });
    expect(redacted.authorization).toBe("[redacted]");
    expect(redacted.bot_token).toBe("[redacted]");
    expect(redacted.wallet).toBe("[redacted]");
    expect(redacted.note).toBe("header [redacted]");
    expect(structuredLog({ secret: "whsec_abc", path: "/health" })).not.toContain("whsec_abc");
    expect(redactText("sk_live_abc")).toBe("[redacted]");
  });
});
