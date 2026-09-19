import { conflict } from "../errors.ts";

export const PAYMENT_STATES = [
  "CREATED",
  "AWAITING_PAYMENT",
  "CONFIRMING",
  "PAID",
  "FULFILLING",
  "FULFILLED",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
] as const;

export type PaymentState = (typeof PAYMENT_STATES)[number];

const allowed: Record<PaymentState, readonly PaymentState[]> = {
  CREATED: ["AWAITING_PAYMENT", "FAILED"],
  AWAITING_PAYMENT: ["CONFIRMING", "EXPIRED", "FAILED"],
  CONFIRMING: ["PAID", "FAILED"],
  PAID: ["FULFILLING", "REFUNDED"],
  FULFILLING: ["FULFILLED", "FAILED"],
  FULFILLED: [],
  FAILED: [],
  EXPIRED: [],
  REFUNDED: [],
};

export function canTransition(from: PaymentState, to: PaymentState): boolean {
  return allowed[from].includes(to);
}

export function assertTransition(from: PaymentState, to: PaymentState): void {
  if (!canTransition(from, to)) {
    throw conflict("illegal_payment_transition", `Cannot transition payment from ${from} to ${to}`);
  }
}
