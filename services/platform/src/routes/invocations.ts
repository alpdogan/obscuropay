import { notFound } from "@obscurus/core";
import { Hono } from "hono";
import { requireMerchant } from "../auth.ts";
import { presentInvocation } from "../presenters.ts";
import { findInvocation, listInvocations } from "../repos/invocations.ts";

export const invocationRoutes = new Hono<{ Bindings: Env; Variables: { merchantId: string } }>();

invocationRoutes.use("*", requireMerchant);

invocationRoutes.get("/", async (c) => {
  const rows = await listInvocations(c.env.DB, c.get("merchantId"), c.req.query("endpoint_id"));
  return c.json({ invocations: rows.map(presentInvocation) });
});

invocationRoutes.get("/:id", async (c) => {
  const row = await findInvocation(c.env.DB, c.get("merchantId"), c.req.param("id"));
  if (!row) {
    throw notFound("invocation");
  }
  return c.json({ invocation: presentInvocation(row) });
});
