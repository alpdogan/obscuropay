import { forbidden, notFound } from "@obscurus/core";
import { Hono } from "hono";
import { fulfillStoredPayment, markMockComplete, verifyStoredPayment } from "../payment-service.ts";
import { presentCheckoutPayment, presentInvocation, presentPayment } from "../presenters.ts";
import { findEndpointById } from "../repos/endpoints.ts";
import { findMerchantById } from "../repos/merchants.ts";
import { findPaymentById } from "../repos/payments.ts";
import type { PaymentRow } from "../repos/types.ts";
import { isProduction } from "../runtime.ts";

export const payRoutes = new Hono<{ Bindings: Env }>();

async function checkoutPayment(env: Env, payment: PaymentRow) {
  const endpoint = payment.endpoint_id ? await findEndpointById(env.DB, payment.endpoint_id) : null;
  const merchant = await findMerchantById(env.DB, payment.merchant_id);
  return presentCheckoutPayment(payment, {
    serviceName: endpoint?.name ?? "Paid request",
    settlementAddress: merchant?.settlement_address ?? null,
    displayName: merchant?.display_name ?? null,
    logoUrl: merchant?.logo_content_type ? `/v1/logos/${merchant.id}` : null,
  });
}

payRoutes.get("/:id", async (c) => {
  const payment = await findPaymentById(c.env.DB, c.req.param("id"));
  if (!payment) {
    throw notFound("payment");
  }
  return c.json({ payment: await checkoutPayment(c.env, payment) });
});

payRoutes.post("/:id/verify", async (c) => {
  const payment = await findPaymentById(c.env.DB, c.req.param("id"));
  if (!payment) {
    throw notFound("payment");
  }
  const verified = await verifyStoredPayment(c.env, payment);
  return c.json({
    payment: await checkoutPayment(c.env, verified.payment),
    matched: verified.payment.state === "PAID" || verified.payment.state === "FULFILLING" || verified.payment.state === "FULFILLED",
  });
});

payRoutes.post("/:id/mock-complete", async (c) => {
  if (isProduction(c.env)) {
    throw forbidden("Mock completion is not available in production");
  }
  const payment = await findPaymentById(c.env.DB, c.req.param("id"));
  if (!payment) {
    throw notFound("payment");
  }
  const marked = await markMockComplete(c.env, payment);
  return c.json({ payment: presentPayment(marked) });
});

payRoutes.post("/:id/fulfill", async (c) => {
  const payment = await findPaymentById(c.env.DB, c.req.param("id"));
  if (!payment) {
    throw notFound("payment");
  }
  const fulfilled = await fulfillStoredPayment(c.env, payment);
  return c.json(
    {
      payment: presentPayment(fulfilled.payment),
      invocation: presentInvocation(fulfilled.invocation),
    },
    fulfilled.invocation.status === "FULFILLED" ? 200 : 502,
  );
});
