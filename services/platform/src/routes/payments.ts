import { notFound } from "@obscurus/core";
import { Hono } from "hono";
import { requireMerchant } from "../auth.ts";
import { presentPayment } from "../presenters.ts";
import { findPaymentForMerchant, listPayments } from "../repos/payments.ts";

export const paymentRoutes = new Hono<{ Bindings: Env; Variables: { merchantId: string } }>();

paymentRoutes.use("*", requireMerchant);

paymentRoutes.get("/", async (c) => {
  const rows = await listPayments(c.env.DB, c.get("merchantId"));
  return c.json({ payments: rows.map(presentPayment) });
});

paymentRoutes.get("/:id", async (c) => {
  const row = await findPaymentForMerchant(c.env.DB, c.get("merchantId"), c.req.param("id"));
  if (!row) {
    throw notFound("payment");
  }
  return c.json({ payment: presentPayment(row) });
});
