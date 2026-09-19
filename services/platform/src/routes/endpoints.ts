import {
  AesGcmSecretBox,
  applyInputMapping,
  assertHttpMethod,
  assertPriceAmount,
  badRequest,
  inspectUrl,
  newId,
  notFound,
  parseCurl,
  parseHeaders,
  parseInputSchema,
  parseResponseMapping,
  secretHint,
  secretNameFromHeader,
  slugify,
  transformResponse,
  validateInput,
  type HeaderSpec,
} from "@obscurus/core";
import { Hono } from "hono";
import { requireMerchant } from "../auth.ts";
import { nowSeconds } from "../clock.ts";
import { executeStoredEndpoint } from "../execute-endpoint.ts";
import { readJson } from "../http/json.ts";
import { presentEndpoint, presentInvocation } from "../presenters.ts";
import { findEndpoint, insertEndpoint, listEndpoints, updateEndpoint } from "../repos/endpoints.ts";
import { findInvocation, insertInvocation, updateInvocation } from "../repos/invocations.ts";
import { findProject } from "../repos/projects.ts";
import { findSecret, insertSecret } from "../repos/secrets.ts";
import type { EndpointRow, InvocationRow } from "../repos/types.ts";
import { isProduction } from "../runtime.ts";

type EndpointBody = {
  project_id?: string;
  name?: string;
  method?: string;
  url?: string;
  headers?: unknown;
  body_template?: string | null;
  input_schema?: unknown;
  price_amount?: string;
  price_asset?: string;
  response?: unknown;
};

export const endpointRoutes = new Hono<{ Bindings: Env; Variables: { merchantId: string } }>();

endpointRoutes.use("*", requireMerchant);

endpointRoutes.post("/from-curl", async (c) => {
  const body = await readJson<{
    project_id?: string;
    curl?: string;
    name?: string;
    customer_fields?: string[];
    price_amount?: string;
    price_asset?: string;
  }>(c.req.raw);
  if (typeof body.curl !== "string") {
    throw badRequest("invalid_curl", "curl is required");
  }
  const project = await findProject(c.env.DB, c.get("merchantId"), body.project_id ?? "");
  if (!project) {
    throw notFound("project");
  }
  const parsed = parseCurl(body.curl);
  const box = AesGcmSecretBox.fromBase64(c.env.SECRET_KEK);
  const now = nowSeconds();
  const headers: HeaderSpec[] = [];
  const storedSecrets: { id: string; name: string; hint: string }[] = [];
  for (const header of parsed.headers) {
    if (header.secret) {
      const id = newId("secret");
      const name = `${secretNameFromHeader(header.name)}_${id.slice(-6)}`;
      await insertSecret(c.env.DB, {
        id,
        merchantId: c.get("merchantId"),
        projectId: project.id,
        name,
        ciphertext: await box.encrypt(header.value),
        hint: secretHint(header.value),
        now,
      });
      storedSecrets.push({ id, name, hint: secretHint(header.value) });
      headers.push({ name: header.name, secretId: id });
    } else {
      headers.push({ name: header.name, value: header.value });
    }
  }
  const selected = body.customer_fields ?? [];
  const mapped =
    parsed.body && selected.length > 0
      ? applyInputMapping(parsed.body, selected)
      : { template: parsed.body, schema: { fields: [] } };
  const row = buildEndpointRow({
    id: newId("endpoint"),
    merchantId: c.get("merchantId"),
    projectId: project.id,
    body: {
      name: body.name ?? "Imported endpoint",
      method: parsed.method,
      url: parsed.url,
      headers,
      body_template: mapped.template,
      input_schema: mapped.schema,
      price_amount: body.price_amount ?? "0.00",
      price_asset: body.price_asset ?? "USDC",
    },
    now,
    allowHttp: !isProduction(c.env),
  });
  await insertEndpoint(c.env.DB, row);
  return c.json(
    {
      endpoint: presentEndpoint(row),
      secrets: storedSecrets,
      warnings: parsed.warnings,
    },
    201,
  );
});

endpointRoutes.post("/", async (c) => {
  const body = await readJson<EndpointBody>(c.req.raw);
  const project = await findProject(c.env.DB, c.get("merchantId"), body.project_id ?? "");
  if (!project) {
    throw notFound("project");
  }
  const row = buildEndpointRow({
    id: newId("endpoint"),
    merchantId: c.get("merchantId"),
    projectId: project.id,
    body,
    now: nowSeconds(),
    allowHttp: !isProduction(c.env),
  });
  await insertEndpoint(c.env.DB, row);
  return c.json({ endpoint: presentEndpoint(row) }, 201);
});

endpointRoutes.get("/", async (c) => {
  const rows = await listEndpoints(c.env.DB, c.get("merchantId"));
  return c.json({ endpoints: rows.map(presentEndpoint) });
});

endpointRoutes.get("/:id", async (c) => {
  const row = await findEndpoint(c.env.DB, c.get("merchantId"), c.req.param("id"));
  if (!row) {
    throw notFound("endpoint");
  }
  return c.json({ endpoint: presentEndpoint(row) });
});

endpointRoutes.patch("/:id", async (c) => {
  const existing = await findEndpoint(c.env.DB, c.get("merchantId"), c.req.param("id"));
  if (!existing) {
    throw notFound("endpoint");
  }
  const body = await readJson<EndpointBody>(c.req.raw);
  const row = buildEndpointRow({
    id: existing.id,
    merchantId: existing.merchant_id,
    projectId: existing.project_id,
    body: {
      name: body.name ?? existing.name,
      method: body.method ?? existing.method,
      url: body.url ?? existing.url,
      headers: body.headers ?? JSON.parse(existing.headers_json),
      body_template: body.body_template === undefined ? existing.body_template : body.body_template,
      input_schema: body.input_schema ?? JSON.parse(existing.input_schema_json),
      price_amount: body.price_amount ?? existing.price_amount,
      price_asset: body.price_asset ?? existing.price_asset,
      response: body.response ?? {
        mode: existing.response_mode,
        select: existing.response_select,
        template: existing.response_template,
      },
    },
    now: existing.created_at,
    updatedAt: nowSeconds(),
    allowHttp: !isProduction(c.env),
  });
  await updateEndpoint(c.env.DB, row);
  return c.json({ endpoint: presentEndpoint(row) });
});

endpointRoutes.post("/:id/test", async (c) => {
  const endpoint = await findEndpoint(c.env.DB, c.get("merchantId"), c.req.param("id"));
  if (!endpoint) {
    throw notFound("endpoint");
  }
  const body = await readJson<{ input?: Record<string, unknown> }>(c.req.raw);
  const schema = parseInputSchema(JSON.parse(endpoint.input_schema_json));
  const input = validateInput(schema, body.input ?? {});
  const now = nowSeconds();
  const invocation: InvocationRow = {
    id: newId("invocation"),
    merchant_id: endpoint.merchant_id,
    project_id: endpoint.project_id,
    endpoint_id: endpoint.id,
    source: "merchant_test",
    status: "FULFILLING",
    input_json: JSON.stringify(input),
    output_preview: null,
    error_class: null,
    http_status: null,
    created_at: now,
    completed_at: null,
  };
  await insertInvocation(c.env.DB, invocation);
  const executed = await executeStoredEndpoint(c.env, endpoint, invocation, input);
  await updateInvocation(c.env.DB, executed);
  const stored = await findInvocation(c.env.DB, c.get("merchantId"), executed.id);
  return c.json({ invocation: presentInvocation(stored ?? executed) }, executed.status === "FULFILLED" ? 200 : 502);
});

endpointRoutes.post("/:id/preview-response", async (c) => {
  const endpoint = await findEndpoint(c.env.DB, c.get("merchantId"), c.req.param("id"));
  if (!endpoint) {
    throw notFound("endpoint");
  }
  const body = await readJson<{ sample?: unknown; mapping?: unknown }>(c.req.raw);
  const mapping = parseResponseMapping(body.mapping ?? {
    mode: endpoint.response_mode,
    select: endpoint.response_select,
    template: endpoint.response_template,
  });
  const raw = typeof body.sample === "string" ? body.sample : JSON.stringify(body.sample ?? {});
  return c.json({ preview: transformResponse(raw, mapping), mapping });
});

function buildEndpointRow(args: {
  id: string;
  merchantId: string;
  projectId: string;
  body: EndpointBody;
  now: number;
  updatedAt?: number;
  allowHttp: boolean;
}): EndpointRow {
  const name = args.body.name?.trim() ?? "";
  if (name.length < 1 || name.length > 80) {
    throw badRequest("invalid_name", "Endpoint name must be between 1 and 80 characters");
  }
  const method = assertHttpMethod(args.body.method ?? "");
  const url = args.body.url?.trim() ?? "";
  const inspected = inspectUrl(url, { allowHttp: args.allowHttp });
  if (!inspected.ok) {
    throw badRequest("invalid_url", `URL rejected: ${inspected.reason}`);
  }
  const schema = parseInputSchema(args.body.input_schema ?? { fields: [] });
  const headers = parseHeaders(args.body.headers);
  const amount = assertPriceAmount(args.body.price_amount ?? "0.00");
  const asset = (args.body.price_asset ?? "USDC").toUpperCase();
  if (!/^[A-Z]{3,8}$/.test(asset)) {
    throw badRequest("invalid_asset", "price_asset must be a short asset code");
  }
  const updated = args.updatedAt ?? args.now;
  const response = parseResponseMapping(args.body.response);
  return {
    id: args.id,
    merchant_id: args.merchantId,
    project_id: args.projectId,
    name,
    slug: slugify(name),
    method,
    url: inspected.url.toString(),
    headers_json: JSON.stringify(headers),
    body_template: args.body.body_template ?? null,
    input_schema_json: JSON.stringify(schema),
    pricing_type: "PER_REQUEST",
    price_amount: amount,
    price_asset: asset,
    response_mode: response.mode,
    response_select: response.select ?? null,
    response_template: response.template ?? null,
    created_at: args.now,
    updated_at: updated,
  };
}
