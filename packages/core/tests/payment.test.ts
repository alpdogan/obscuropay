import { describe, expect, it } from "vitest";
import { DomainError } from "../src/errors.ts";
import { claimEntitlement, createPerRequestEntitlement } from "../src/payment/entitlement.ts";
import {
  applyVerification,
  beginFulfillment,
  canIssueEntitlement,
  completeFulfillment,
  expirePayment,
  failPayment,
  openPayment,
  refundPayment,
  requirePaidForFulfill,
} from "../src/payment/lifecycle.ts";
import { MockPaymentProvider } from "../src/payment/mock.ts";
import { assertImplementedPricing, parsePricingType } from "../src/payment/pricing.ts";
import type { PaymentRecord } from "../src/payment/provider.ts";
import { canTransition } from "../src/payment/states.ts";

function payment(state: PaymentRecord["state"], expiresAt: number | null = 9_999_999_999): PaymentRecord {
  return {
    id: "pay_1",
    merchantId: "merch_1",
    endpointId: "ept_1",
    invocationId: "inv_1",
    amount: "0.50",
    asset: "USDC",
    state,
    paymentRef: "ab".repeat(32),
    provider: "mock",
    expiresAt,
  };
}

describe("payment state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("CREATED", "AWAITING_PAYMENT")).toBe(true);
    expect(canTransition("AWAITING_PAYMENT", "CONFIRMING")).toBe(true);
    expect(canTransition("CONFIRMING", "PAID")).toBe(true);
    expect(canTransition("PAID", "FULFILLING")).toBe(true);
    expect(canTransition("FULFILLING", "FULFILLED")).toBe(true);
  });

  it("allows failure and expiry exits", () => {
    expect(canTransition("CREATED", "FAILED")).toBe(true);
    expect(canTransition("AWAITING_PAYMENT", "EXPIRED")).toBe(true);
    expect(canTransition("AWAITING_PAYMENT", "FAILED")).toBe(true);
    expect(canTransition("CONFIRMING", "FAILED")).toBe(true);
    expect(canTransition("FULFILLING", "FAILED")).toBe(true);
    expect(canTransition("PAID", "REFUNDED")).toBe(true);
  });

  it("rejects skipping unpaid fulfillment", () => {
    expect(canTransition("AWAITING_PAYMENT", "PAID")).toBe(false);
    expect(canTransition("CREATED", "FULFILLED")).toBe(false);
    expect(canTransition("FULFILLED", "REFUNDED")).toBe(false);
    expect(canTransition("EXPIRED", "PAID")).toBe(false);
  });
});

describe("payment lifecycle", () => {
  it("opens CREATED payments and verifies idempotently", () => {
    const opened = openPayment(payment("CREATED"));
    expect(opened.state).toBe("AWAITING_PAYMENT");

    const pending = applyVerification(opened, { matched: false, state: "AWAITING_PAYMENT" }, 1);
    expect(pending.state).toBe("AWAITING_PAYMENT");

    const first = applyVerification(opened, { matched: true, state: "PAID" }, 1);
    expect(first.state).toBe("PAID");
    expect(canIssueEntitlement(first)).toBe(true);

    const second = applyVerification(first, { matched: true, state: "PAID" }, 1);
    expect(second.state).toBe("PAID");
  });

  it("expires unpaid payments and fulfills paid ones once", () => {
    const expired = applyVerification(payment("AWAITING_PAYMENT", 10), { matched: true, state: "PAID" }, 10);
    expect(expired.state).toBe("EXPIRED");
    expect(expirePayment(expired).state).toBe("EXPIRED");

    const fulfilling = beginFulfillment(payment("PAID"));
    expect(fulfilling.state).toBe("FULFILLING");
    expect(completeFulfillment(fulfilling).state).toBe("FULFILLED");
    expect(completeFulfillment(completeFulfillment(fulfilling)).state).toBe("FULFILLED");
    expect(() => requirePaidForFulfill(payment("AWAITING_PAYMENT"))).toThrow(DomainError);
    expect(failPayment(payment("CREATED")).state).toBe("FAILED");
  });

  it("does not implement refunds", () => {
    expect(() => refundPayment(payment("PAID"))).toThrow(/not implemented/);
  });
});

describe("pricing types", () => {
  it("reserves later pricing models without implementing them", () => {
    expect(parsePricingType("PER_REQUEST")).toBe("PER_REQUEST");
    expect(parsePricingType("CREDIT_PACK")).toBe("CREDIT_PACK");
    expect(parsePricingType("SUBSCRIPTION")).toBe("SUBSCRIPTION");
    expect(parsePricingType("ONE_TIME_UNLOCK")).toBe("ONE_TIME_UNLOCK");
    expect(() => assertImplementedPricing("CREDIT_PACK")).toThrow(/reserved/);
    assertImplementedPricing("PER_REQUEST");
  });
});

describe("single-use entitlements", () => {
  it("cannot be claimed twice", () => {
    const unused = createPerRequestEntitlement({
      id: "ent_1",
      merchantId: "merch_1",
      endpointId: "ept_1",
      invocationId: "inv_1",
      paymentId: "pay_1",
      createdAt: 1,
    });
    const claimed = claimEntitlement(unused, 2);
    expect(claimed.status).toBe("CLAIMED");
    expect(claimed.claimedAt).toBe(2);
    expect(() => claimEntitlement(claimed, 3)).toThrow(DomainError);
    expect(() => claimEntitlement(claimed, 3)).toThrow(/cannot execute twice/);
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
