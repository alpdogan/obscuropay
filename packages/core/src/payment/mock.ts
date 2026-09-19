import { newId, newPaymentRef } from "../ids.ts";
import type { CreatePaymentInput, PaymentProvider, PaymentRecord, VerificationResult } from "./provider.ts";
import { assertTransition } from "./states.ts";

/**
 * In-memory provider for development and tests. Not for production.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  private readonly payments = new Map<string, PaymentRecord>();
  private readonly completable = new Set<string>();

  async createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    const payment: PaymentRecord = {
      id: newId("payment"),
      merchantId: input.merchantId,
      endpointId: input.endpointId,
      invocationId: input.invocationId,
      amount: input.amount,
      asset: input.asset,
      state: "AWAITING_PAYMENT",
      paymentRef: newPaymentRef(),
      provider: this.name,
    };
    this.payments.set(payment.id, payment);
    return payment;
  }

  /** Test helper: the next VerifyPayment will succeed. */
  markComplete(paymentId: string): void {
    this.completable.add(paymentId);
  }

  async verifyPayment(paymentId: string): Promise<VerificationResult> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return { matched: false, state: "FAILED" };
    }
    if (payment.state === "PAID" || payment.state === "FULFILLING" || payment.state === "FULFILLED") {
      return { matched: true, state: payment.state };
    }
    if (!this.completable.has(paymentId)) {
      return { matched: false, state: payment.state };
    }
    if (payment.state === "AWAITING_PAYMENT") {
      assertTransition(payment.state, "CONFIRMING");
      payment.state = "CONFIRMING";
    }
    if (payment.state === "CONFIRMING") {
      assertTransition(payment.state, "PAID");
      payment.state = "PAID";
    }
    this.completable.delete(paymentId);
    this.payments.set(paymentId, payment);
    return { matched: true, state: payment.state };
  }

  async getPayment(paymentId: string): Promise<PaymentRecord | null> {
    return this.payments.get(paymentId) ?? null;
  }
}
