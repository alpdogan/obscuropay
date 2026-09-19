import {
  badRequest,
  conflict,
  notFound,
  parseInputSchema,
  parseInvokeResult,
  paymentRequiredBody,
  validateInput,
} from "@obscurus/core";
import { Hono } from "hono";
import { readJson } from "../http/json.ts";
import { fulfillStoredPayment, startPaidInvocation, verifyStoredPayment } from "../payment-service.ts";
import { presentInvocation, presentPayment } from "../presenters.ts";
import { findEndpointById, findEndpointBySlug, findEndpointsBySlug } from "../repos/endpoints.ts";
import { findPaymentById } from "../repos/payments.ts";

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

function invokeInput(body: Record<string, unknown>): Record<string, unknown> {
  if (body.input && typeof body.input === "object" && !Array.isArray(body.input)) {
    return body.input as Record<string, unknown>;
  }
  const reserved = new Set(["payment_id", "project_id", "endpoint_id", "input"]);
  return Object.fromEntries(Object.entries(body).filter(([key]) => !reserved.has(key)));
}

async function resolveInvokeEndpoint(env: Env, ref: string, projectId?: string) {
  if (ref.startsWith("ept_")) {
    const row = await findEndpointById(env.DB, ref);
    if (!row) {
      throw notFound("endpoint");
    }
    return row;
  }
  if (projectId) {
    const row = await findEndpointBySlug(env.DB, projectId, ref);
    if (!row) {
      throw notFound("endpoint");
    }
    return row;
  }
  const rows = await findEndpointsBySlug(env.DB, ref);
  if (rows.length === 0) {
    throw notFound("endpoint");
  }
  if (rows.length > 1) {
    throw conflict("ambiguous_endpoint", "project_id is required when multiple endpoints share this slug");
  }
  return rows[0]!;
}

invokeRoutes.post("/:ref", async (c) => {
  const body = await readJson<Record<string, unknown>>(c.req.raw);
  const endpoint = await resolveInvokeEndpoint(
    c.env,
    c.req.param("ref"),
    typeof body.project_id === "string" ? body.project_id : undefined,
  );
  const input = validateInput(parseInputSchema(JSON.parse(endpoint.input_schema_json)), invokeInput(body));
  const paymentId = typeof body.payment_id === "string" ? body.payment_id : undefined;

  if (paymentId) {
    const payment = await findPaymentById(c.env.DB, paymentId);
    if (!payment || payment.endpoint_id !== endpoint.id) {
      throw notFound("payment");
    }
    const verified = await verifyStoredPayment(c.env, payment);
    const payable =
      verified.payment.state === "PAID" ||
      verified.payment.state === "FULFILLING" ||
      verified.payment.state === "FULFILLED";
    if (!payable) {
      return c.json(paymentRequiredBody(presentPayment(verified.payment)), 402);
    }
    const fulfilled = await fulfillStoredPayment(c.env, verified.payment);
    return c.json(
      { result: parseInvokeResult(fulfilled.invocation.output_preview) },
      fulfilled.invocation.status === "FULFILLED" ? 200 : 502,
    );
  }

  const started = await startPaidInvocation(c.env, endpoint.id, input, "http");
  return c.json(paymentRequiredBody(presentPayment(started.payment)), 402);
});
