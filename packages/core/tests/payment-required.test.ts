import { describe, expect, it } from "vitest";
import { parseInvokeResult, paymentRequiredBody } from "../src/http/payment-required.ts";

describe("payment required", () => {
  it("returns an Obscurus-native 402 body without wallets", () => {
    const body = paymentRequiredBody({
      id: "pay_1",
      amount: "0.50",
      asset: "USDC",
      checkout_url: "/pay/pay_1",
    });
    expect(body.error).toBe("payment_required");
    expect(body.payment.checkout_url).toBe("/pay/pay_1");
    expect(JSON.stringify(body)).not.toMatch(/wallet|0x[a-fA-F0-9]{40}|PAYMENT-SIGNATURE/);
  });

  it("parses JSON previews and leaves text as text", () => {
    expect(parseInvokeResult('{"ok":true}')).toEqual({ ok: true });
    expect(parseInvokeResult("Name: John")).toBe("Name: John");
  });
});
