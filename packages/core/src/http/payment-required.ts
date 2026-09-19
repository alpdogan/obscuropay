export type PaymentRequiredBody = {
  error: "payment_required";
  payment: {
    id: string;
    amount: string;
    asset: string;
    checkout_url: string;
  };
};

export function paymentRequiredBody(payment: {
  id: string;
  amount: string;
  asset: string;
  checkout_url: string;
}): PaymentRequiredBody {
  return {
    error: "payment_required",
    payment: {
      id: payment.id,
      amount: payment.amount,
      asset: payment.asset,
      checkout_url: payment.checkout_url,
    },
  };
}

export function parseInvokeResult(preview: string | null): unknown {
  if (preview === null || preview === "") {
    return null;
  }
  try {
    return JSON.parse(preview) as unknown;
  } catch {
    return preview;
  }
}
