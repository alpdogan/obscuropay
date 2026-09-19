import { platformUrl, type CheckoutConfig } from "./config.ts";

export type CheckoutPayment = {
  id: string;
  amount: string;
  asset: string;
  state: string;
  payment_ref: string;
  expires_at: number | null;
  service_name: string;
  settlement_address: string | null;
  checkout_url: string;
};

export async function fetchPayment(config: CheckoutConfig, paymentId: string): Promise<CheckoutPayment> {
  const response = await fetch(platformUrl(config, `/v1/pay/${paymentId}`), { cache: "no-store" });
  const body = (await response.json()) as { payment?: CheckoutPayment; error?: { message: string } };
  if (!response.ok || !body.payment) {
    throw new Error(body.error?.message ?? "Payment not found");
  }
  return body.payment;
}

export async function postPayment(config: CheckoutConfig, paymentId: string, action: "verify" | "fulfill" | "mock-complete") {
  const response = await fetch(platformUrl(config, `/v1/pay/${paymentId}/${action}`), { method: "POST" });
  const body = await response.json();
  if (!response.ok) {
    const error = body as { error?: { message: string } };
    throw new Error(error.error?.message ?? `Payment ${action} failed`);
  }
  return body as { payment: CheckoutPayment; invocation?: { status: string; output_preview: string | null } };
}
