import { badRequest } from "../errors.ts";
import { parseInputSchema, type InputField, type InputSchema } from "../endpoint/schema.ts";

export type McpJsonSchema = {
  type: "object";
  properties: Record<string, { type: "string" | "number" | "boolean"; enum?: string[] }>;
  required: string[];
};

export type McpTool = {
  name: string;
  description: string;
  inputSchema: McpJsonSchema;
  _meta: {
    obscurus: {
      amount: string;
      asset: string;
      pricing_type: string;
      silent_spend: false;
    };
  };
};

export function inputSchemaToJsonSchema(schema: InputSchema): McpJsonSchema {
  const properties: McpJsonSchema["properties"] = {};
  const required: string[] = [];
  for (const field of schema.fields) {
    properties[field.name] = jsonSchemaProperty(field);
    if (field.required) {
      required.push(field.name);
    }
  }
  return { type: "object", properties, required };
}

function jsonSchemaProperty(field: InputField): McpJsonSchema["properties"][string] {
  if (field.type === "enum") {
    return { type: "string", enum: field.options };
  }
  if (field.type === "number") {
    return { type: "number" };
  }
  if (field.type === "boolean") {
    return { type: "boolean" };
  }
  return { type: "string" };
}

export function endpointToMcpTool(input: {
  slug: string;
  name: string;
  inputSchema: unknown;
  priceAmount: string;
  priceAsset: string;
  pricingType: string;
}): McpTool {
  const schema = parseInputSchema(input.inputSchema);
  return {
    name: input.slug,
    description: `${input.name}. ${input.priceAmount} ${input.priceAsset} per request. Payment authorization is required; this tool never spends silently.`,
    inputSchema: inputSchemaToJsonSchema(schema),
    _meta: {
      obscurus: {
        amount: input.priceAmount,
        asset: input.priceAsset,
        pricing_type: input.pricingType,
        silent_spend: false,
      },
    },
  };
}

export function assertNoSilentMcpSpend(params: unknown): void {
  if (!params || typeof params !== "object") {
    return;
  }
  const rec = params as Record<string, unknown>;
  const flagged = [rec.paid, rec.auto_spend, rec.auto_pay, rec.spend_without_auth];
  if (flagged.some((value) => value === true || value === "true")) {
    throw badRequest("silent_spend_forbidden", "MCP tools cannot spend without an explicit payment authorization");
  }
  const args = rec.arguments;
  if (args && typeof args === "object") {
    const inner = args as Record<string, unknown>;
    if (inner.paid === true || inner.auto_spend === true || inner.auto_pay === true) {
      throw badRequest("silent_spend_forbidden", "MCP tools cannot spend without an explicit payment authorization");
    }
  }
}

export type McpSpendingPolicy = {
  max_per_call?: string;
  max_per_day?: string;
  allowed_tools?: string[];
  allowed_merchants?: string[];
  total_budget?: string;
};

export function parseMcpSpendingPolicy(value: unknown): McpSpendingPolicy {
  if (value === undefined || value === null) {
    return {};
  }
  if (!value || typeof value !== "object") {
    throw badRequest("invalid_spending_policy", "Spending policy must be an object");
  }
  const rec = value as Record<string, unknown>;
  if (rec.auto_spend === true || rec.auto_pay === true) {
    throw badRequest("silent_spend_forbidden", "Automatic MCP spend is not implemented");
  }
  const policy: McpSpendingPolicy = {};
  if (typeof rec.max_per_call === "string") {
    policy.max_per_call = rec.max_per_call;
  }
  if (typeof rec.max_per_day === "string") {
    policy.max_per_day = rec.max_per_day;
  }
  if (Array.isArray(rec.allowed_tools) && rec.allowed_tools.every((item) => typeof item === "string")) {
    policy.allowed_tools = rec.allowed_tools;
  }
  if (Array.isArray(rec.allowed_merchants) && rec.allowed_merchants.every((item) => typeof item === "string")) {
    policy.allowed_merchants = rec.allowed_merchants;
  }
  if (typeof rec.total_budget === "string") {
    policy.total_budget = rec.total_budget;
  }
  return policy;
}
