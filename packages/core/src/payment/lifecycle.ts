import { badRequest, conflict } from "../errors.ts";
import type { PaymentRecord, VerificationResult } from "./provider.ts";
import { assertTransition, type PaymentState } from "./states.ts";

const TERMINAL: readonly PaymentState[] = ["FULFILLED", "FAILED", "EXPIRED", "REFUNDED"];
const ALREADY_PAID: readonly PaymentState[] = ["PAID", "FULFILLING", "FULFILLED"];

export function openPayment(payment: PaymentRecord): PaymentRecord {
  if (payment.state === "AWAITING_PAYMENT") {
    return payment;
  }
  assertTransition(payment.state, "AWAITING_PAYMENT");
  return { ...payment, state: "AWAITING_PAYMENT" };
}

export function isExpired(payment: PaymentRecord, now: number): boolean {
  return payment.expiresAt != null && now >= payment.expiresAt && payment.state === "AWAITING_PAYMENT";
}

export function expirePayment(payment: PaymentRecord): PaymentRecord {
  if (payment.state === "EXPIRED") {
    return payment;
  }
  assertTransition(payment.state, "EXPIRED");
  return { ...payment, state: "EXPIRED" };
}

export function failPayment(payment: PaymentRecord): PaymentRecord {
  if (payment.state === "FAILED") {
    return payment;
  }
  assertTransition(payment.state, "FAILED");
  return { ...payment, state: "FAILED" };
}

export function refundPayment(_payment: PaymentRecord): PaymentRecord {
  throw badRequest("refund_not_implemented", "Refund() is not implemented in the MVP");
}

export function applyVerification(
  payment: PaymentRecord,
  result: VerificationResult,
  now: number,
): PaymentRecord {
  if (TERMINAL.includes(payment.state) || payment.state === "FULFILLING") {
    return payment;
  }
  if (isExpired(payment, now)) {
    return expirePayment(payment);
  }
  if (ALREADY_PAID.includes(payment.state)) {
    return payment;
  }
  if (!result.matched) {
    return payment;
  }
  let next = payment;
  if (next.state === "AWAITING_PAYMENT") {
    assertTransition(next.state, "CONFIRMING");
    next = { ...next, state: "CONFIRMING" };
  }
  if (next.state === "CONFIRMING") {
    assertTransition(next.state, "PAID");
    next = { ...next, state: "PAID" };
  }
  return next;
}

export function requirePaidForFulfill(payment: PaymentRecord): void {
  if (payment.state === "FULFILLED" || payment.state === "FULFILLING" || payment.state === "PAID") {
    return;
  }
  throw conflict("payment_not_paid", `Payment is ${payment.state} and cannot be fulfilled`);
}

export function beginFulfillment(payment: PaymentRecord): PaymentRecord {
  if (payment.state === "FULFILLING" || payment.state === "FULFILLED") {
    return payment;
  }
  assertTransition(payment.state, "FULFILLING");
  return { ...payment, state: "FULFILLING" };
}

export function completeFulfillment(payment: PaymentRecord): PaymentRecord {
  if (payment.state === "FULFILLED") {
    return payment;
  }
  assertTransition(payment.state, "FULFILLED");
  return { ...payment, state: "FULFILLED" };
}

export function canIssueEntitlement(payment: PaymentRecord): boolean {
  return payment.state === "PAID";
}
