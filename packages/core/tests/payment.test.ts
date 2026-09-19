import { describe, expect, it } from "vitest";
import { MockPaymentProvider } from "../src/payment/mock.ts";
import { canTransition } from "../src/payment/states.ts";

describe("payment state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("CREATED", "AWAITING_PAYMENT")).toBe(true);
    expect(canTransition("AWAITING_PAYMENT", "CONFIRMING")).toBe(true);
    expect(canTransition("CONFIRMING", "PAID")).toBe(true);
    expect(canTransition("PAID", "FULFILLING")).toBe(true);
    expect(canTransition("FULFILLING", "FULFILLED")).toBe(true);
  });

  it("rejects skipping unpaid fulfillment", () => {
    expect(canTransition("AWAITING_PAYMENT", "PAID")).toBe(false);
    expect(canTransition("CREATED", "FULFILLED")).toBe(false);
  });
});

describe("MockPaymentProvider", () => {
  it("creates and verifies a payment idempotently", async () => {
    const provider = new MockPaymentProvider();
    const created = await provider.createPayment({
      merchantId: "merch_1",
      endpointId: "ept_1",
      invocationId: "inv_1",
      amount: "0.50",
      asset: "USDC",
    });
    expect(created.state).toBe("AWAITING_PAYMENT");
    expect(created.paymentRef).toHaveLength(64);

    const pending = await provider.verifyPayment(created.id);
    expect(pending.matched).toBe(false);

    provider.markComplete(created.id);
    const first = await provider.verifyPayment(created.id);
    expect(first.matched).toBe(true);
    expect(first.state).toBe("PAID");

    const second = await provider.verifyPayment(created.id);
    expect(second.matched).toBe(true);
    expect(second.state).toBe("PAID");
  });
});
