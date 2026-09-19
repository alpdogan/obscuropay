import {
  assertNoSilentMcpSpend,
  DomainError,
  endpointToMcpTool,
  notFound,
  parseInputSchema,
  parseMcpSpendingPolicy,
  validateInput,
} from "@obscurus/core";
import { Hono } from "hono";
import { requireMerchant } from "../auth.ts";
import { fulfillStoredPayment, startPaidInvocation, verifyStoredPayment } from "../payment-service.ts";
import { presentPayment } from "../presenters.ts";
import { findEndpointBySlug, listEndpointsByProject } from "../repos/endpoints.ts";
import { findPaymentById } from "../repos/payments.ts";
import { findProjectById, listProjects } from "../repos/projects.ts";
import { publicOrigin } from "../telegram/origin.ts";

export const mcpMerchantRoutes = new Hono<{ Bindings: Env; Variables: { merchantId: string } }>();
export const mcpGatewayRoutes = new Hono<{ Bindings: Env }>();

mcpMerchantRoutes.use("*", requireMerchant);

mcpMerchantRoutes.get("/", async (c) => {
  const origin = publicOrigin(c.env, c.req.url);
  const projects = await listProjects(c.env.DB, c.get("merchantId"));
  return c.json({
    servers: projects.map((project) => ({
      project_id: project.id,
      name: project.name,
      url: `${origin}/v1/mcp/${project.id}`,
    })),
    spending_policy: {
      designed: ["max_per_call", "max_per_day", "allowed_tools", "allowed_merchants", "total_budget"],
      implemented: [],
      silent_spend: false,
    },
  });
});

type RpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

function rpcResult(id: string | number | null | undefined, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id: string | number | null | undefined, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
}

function toolFromRow(row: { slug: string; name: string; input_schema_json: string; price_amount: string; price_asset: string; pricing_type: string }) {
  return endpointToMcpTool({
    slug: row.slug,
    name: row.name,
    inputSchema: JSON.parse(row.input_schema_json),
    priceAmount: row.price_amount,
    priceAsset: row.price_asset,
    pricingType: row.pricing_type,
  });
}

function paymentRequiredResult(payment: { id: string; amount: string; asset: string; checkout_url: string }) {
  return {
    content: [
      {
        type: "text",
        text: `Payment required: ${payment.amount} ${payment.asset}. Authorize checkout, then call again with payment_id.`,
      },
    ],
    isError: true,
    structuredContent: {
      error: "payment_required",
      payment,
    },
  };
}

mcpGatewayRoutes.post("/:projectId", async (c) => {
  const project = await findProjectById(c.env.DB, c.req.param("projectId"));
  if (!project) {
    throw notFound("project");
  }
  const body = (await c.req.json().catch(() => null)) as RpcRequest | null;
  if (!body || body.jsonrpc !== "2.0" || !body.method) {
    return c.json(rpcError(body?.id, -32600, "Invalid Request"), 400);
  }

  try {
    if (body.method === "initialize") {
      return c.json(
        rpcResult(body.id, {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "obscurus", version: "0.0.0" },
          instructions: "Discover tools, then authorize payment before execution. Silent spend is rejected.",
        }),
      );
    }
    if (body.method === "notifications/initialized" || body.method === "ping") {
      return body.method === "ping" ? c.json(rpcResult(body.id, {})) : c.body(null, 204);
    }
    if (body.method === "tools/list") {
      const rows = await listEndpointsByProject(c.env.DB, project.id);
      return c.json(rpcResult(body.id, { tools: rows.map(toolFromRow) }));
    }
    if (body.method === "tools/call") {
      assertNoSilentMcpSpend(body.params);
      parseMcpSpendingPolicy(
        body.params && typeof body.params === "object"
          ? (body.params as { spending_policy?: unknown }).spending_policy
          : undefined,
      );
      const params = (body.params ?? {}) as {
        name?: string;
        arguments?: Record<string, unknown>;
        payment_id?: string;
      };
      if (!params.name) {
        return c.json(rpcError(body.id, -32602, "Tool name is required"), 400);
      }
      const endpoint = await findEndpointBySlug(c.env.DB, project.id, params.name);
      if (!endpoint) {
        return c.json(rpcError(body.id, -32602, `Unknown tool ${params.name}`), 404);
      }
      const input = validateInput(parseInputSchema(JSON.parse(endpoint.input_schema_json)), params.arguments ?? {});

      if (params.payment_id) {
        const payment = await findPaymentById(c.env.DB, params.payment_id);
        if (!payment || payment.endpoint_id !== endpoint.id) {
          return c.json(rpcError(body.id, -32602, "payment_id does not authorize this tool"), 404);
        }
        const verified = await verifyStoredPayment(c.env, payment);
        const payable =
          verified.payment.state === "PAID" ||
          verified.payment.state === "FULFILLING" ||
          verified.payment.state === "FULFILLED";
        if (!payable) {
          return c.json(rpcResult(body.id, paymentRequiredResult(presentPayment(verified.payment))));
        }
        const fulfilled = await fulfillStoredPayment(c.env, verified.payment);
        return c.json(
          rpcResult(body.id, {
            content: [{ type: "text", text: fulfilled.invocation.output_preview ?? "Paid request completed." }],
            structuredContent: {
              result: fulfilled.invocation.output_preview,
              invocation_id: fulfilled.invocation.id,
              status: fulfilled.invocation.status,
            },
            isError: fulfilled.invocation.status !== "FULFILLED",
          }),
        );
      }

      const started = await startPaidInvocation(c.env, endpoint.id, input, "mcp");
      return c.json(rpcResult(body.id, paymentRequiredResult(presentPayment(started.payment))));
    }
    return c.json(rpcError(body.id, -32601, `Method not found: ${body.method}`), 404);
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(rpcError(body.id, -32602, error.message, { code: error.code }), error.status === 404 ? 404 : 400);
    }
    throw error;
  }
});
