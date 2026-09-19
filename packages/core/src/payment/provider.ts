import type { PaymentState } from "./states.ts";

export type CreatePaymentInput = {
  merchantId: string;
  endpointId: string;
  invocationId: string;
  amount: string;
  asset: string;
};

export type PaymentRecord = {
  id: string;
  merchantId: string;
  endpointId: string;
  invocationId: string;
  amount: string;
  asset: string;
  state: PaymentState;
  paymentRef: string;
  provider: string;
};

export type VerificationResult = {
  matched: boolean;
  state: PaymentState;
};

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentRecord>;
  verifyPayment(paymentId: string): Promise<VerificationResult>;
  getPayment(paymentId: string): Promise<PaymentRecord | null>;
}
