import { badRequest } from "@obscurus/core";
import { Hono } from "hono";
import { readJson } from "../http/json.ts";
import { startPaidInvocation } from "../payment-service.ts";
import { presentInvocation, presentPayment } from "../presenters.ts";

export const invokeRoutes = new Hono<{ Bindings: Env }>();

invokeRoutes.post("/", async (c) => {
  const body = await readJson<{ endpoint_id?: string; input?: Record<string, unknown> }>(c.req.raw);
  if (!body.endpoint_id) {
    throw badRequest("invalid_endpoint", "endpoint_id is required");
  }
  const started = await startPaidInvocation(c.env, body.endpoint_id, body.input ?? {});
  return c.json(
    {
      invocation: presentInvocation(started.invocation),
      payment: presentPayment(started.payment),
    },
    201,
  );
});
