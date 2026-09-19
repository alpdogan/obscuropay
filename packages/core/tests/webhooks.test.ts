import { describe, expect, it } from "vitest";
import {
  assertWebhookPayloadSafe,
  buildWebhookPayload,
  nextWebhookAttemptAt,
  signWebhook,
  verifyWebhookSignature,
} from "../src/webhooks/sign.ts";

describe("webhook signatures", () => {
  it("accepts a fresh HMAC and rejects skew or wallets", async () => {
    const secret = "whsec_test";
    const body = JSON.stringify(
      buildWebhookPayload({
        id: "whd_1",
        event: "payment.confirmed",
        paymentId: "pay_1",
        endpoint: "person_search",
        amount: "0.50",
        asset: "USDC",
      }),
    );
    const timestamp = "1000";
    const signature = await signWebhook(secret, timestamp, body);
    expect(
      await verifyWebhookSignature({ secret, timestamp, body, signature, now: 1000 }),
    ).toBe(true);
    expect(
      await verifyWebhookSignature({ secret, timestamp, body, signature, now: 1000 + 301 }),
    ).toBe(false);
    expect(() => assertWebhookPayloadSafe({ wallet: "0x1" })).toThrow(/wallet/);
    expect(nextWebhookAttemptAt(5, 0)).toBeNull();
  });
});
