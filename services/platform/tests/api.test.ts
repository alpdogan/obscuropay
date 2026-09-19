import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function register(email: string) {
  return SELF.fetch("https://obscurus.test/v1/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse" }),
  });
}

function cookie(response: Response): string {
  return response.headers.get("set-cookie") ?? "";
}

describe("observability", () => {
  it("exposes health and ready with request ids and no secrets", async () => {
    const health = await SELF.fetch("https://obscurus.test/health", { headers: { "X-Request-Id": "req_testhealth" } });
    expect(health.status).toBe(200);
    expect(health.headers.get("X-Request-Id")).toBe("req_testhealth");
    const healthJson = await health.json();
    expect(healthJson).toMatchObject({ status: "ok", request_id: "req_testhealth" });
    expect(JSON.stringify(healthJson)).not.toMatch(/SECRET_KEK|sk_|whsec_/);

    const ready = await SELF.fetch("https://obscurus.test/ready");
    expect(ready.status).toBe(200);
    expect(((await ready.json()) as { status: string }).status).toBe("ready");
    expect(ready.headers.get("X-Request-Id")).toMatch(/^req_/);
  });
});

describe("merchant API", () => {
  it("registers, stores a redacted secret, and manages an endpoint", async () => {
    const created = await register("merchant@example.com");
    expect(created.status).toBe(201);
    const session = cookie(created);
    expect(session).toContain("HttpOnly");

    const me = await SELF.fetch("https://obscurus.test/v1/auth/me", { headers: { cookie: session } });
    expect(me.status).toBe(200);

    const projectRes = await SELF.fetch("https://obscurus.test/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ name: "Acme Search" }),
    });
    expect(projectRes.status).toBe(201);
    const project = ((await projectRes.json()) as { project: { id: string } }).project;

    const secretRes = await SELF.fetch("https://obscurus.test/v1/secrets", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ project_id: project.id, name: "acme_key", value: "sk_live_secret" }),
    });
    expect(secretRes.status).toBe(201);
    const secret = ((await secretRes.json()) as { secret: { id: string; hint: string; value?: string } }).secret;
    expect(secret.hint).toBe("••••cret");
    expect(secret.value).toBeUndefined();

    const listedSecrets = await SELF.fetch(`https://obscurus.test/v1/secrets?project_id=${project.id}`, {
      headers: { cookie: session },
    });
    expect(JSON.stringify(await listedSecrets.json())).not.toContain("sk_live_secret");

    const endpointRes = await SELF.fetch("https://obscurus.test/v1/endpoints", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({
        project_id: project.id,
        name: "person search",
        method: "POST",
        url: "https://example.com/search",
        headers: [{ name: "Authorization", secret_id: secret.id }],
        body_template: '{"query":"{{input.query}}"}',
        input_schema: { fields: [{ name: "query", type: "string", required: true }] },
        price_amount: "0.50",
        price_asset: "USDC",
      }),
    });
    expect(endpointRes.status).toBe(201);
    const endpoint = ((await endpointRes.json()) as { endpoint: { id: string; slug: string } }).endpoint;
    expect(endpoint.slug).toBe("person_search");

    const getOne = await SELF.fetch(`https://obscurus.test/v1/endpoints/${endpoint.id}`, {
      headers: { cookie: session },
    });
    expect(getOne.status).toBe(200);
    const listed = await SELF.fetch("https://obscurus.test/v1/endpoints", { headers: { cookie: session } });
    expect(listed.status).toBe(200);
    expect(((await listed.json()) as { endpoints: { id: string }[] }).endpoints[0]?.id).toBe(endpoint.id);

    const patched = await SELF.fetch(`https://obscurus.test/v1/endpoints/${endpoint.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ price_amount: "0.75" }),
    });
    expect(patched.status).toBe(200);
    const patchedJson = (await patched.json()) as { endpoint: { pricing: { amount: string } } };
    expect(patchedJson.endpoint.pricing.amount).toBe("0.75");

    const preview = await SELF.fetch(`https://obscurus.test/v1/endpoints/${endpoint.id}/preview-response`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({
        sample: { data: { name: "John", company: "Acme" } },
        mapping: { mode: "template", template: "Name: {{data.name}}" },
      }),
    });
    expect(preview.status).toBe(200);
    expect(((await preview.json()) as { preview: string }).preview).toBe("Name: John");

    const invocations = await SELF.fetch("https://obscurus.test/v1/invocations", {
      headers: { cookie: session },
    });
    expect(invocations.status).toBe(200);
  });

  it("imports cURL without echoing secrets and can create an endpoint", async () => {
    const created = await register("curl@example.com");
    const session = cookie(created);
    const projectRes = await SELF.fetch("https://obscurus.test/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ name: "Curl" }),
    });
    const project = ((await projectRes.json()) as { project: { id: string } }).project;
    const curl = `curl -X POST https://example.com/search -H "Authorization: Bearer SUPERSECRET" -H "Content-Type: application/json" -d '{"query":"john"}'`;

    const imported = await SELF.fetch("https://obscurus.test/v1/curl/import", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ curl }),
    });
    expect(imported.status).toBe(200);
    const importJson = (await imported.json()) as {
      import: { headers: { value: string; secret: boolean }[]; suggested_inputs: { name: string }[] };
    };
    expect(JSON.stringify(importJson)).not.toContain("SUPERSECRET");
    expect(importJson.import.headers[0]?.secret).toBe(true);
    expect(importJson.import.suggested_inputs[0]?.name).toBe("query");

    const fromCurl = await SELF.fetch("https://obscurus.test/v1/endpoints/from-curl", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({
        project_id: project.id,
        curl,
        name: "imported search",
        customer_fields: ["query"],
        price_amount: "0.50",
      }),
    });
    expect(fromCurl.status).toBe(201);
    const createdEndpoint = (await fromCurl.json()) as {
      endpoint: { body_template: string; headers: { secret_id?: string }[] };
      secrets: { hint: string }[];
    };
    expect(createdEndpoint.endpoint.body_template).toBe('{"query":"{{input.query}}"}');
    expect(createdEndpoint.endpoint.headers[0]?.secret_id).toBeTruthy();
    expect(JSON.stringify(createdEndpoint)).not.toContain("SUPERSECRET");
  });

  it("rejects unauthenticated access and localhost endpoints", async () => {
    const anon = await SELF.fetch("https://obscurus.test/v1/projects");
    expect(anon.status).toBe(401);
    const anonImport = await SELF.fetch("https://obscurus.test/v1/curl/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ curl: "curl https://example.com" }),
    });
    expect(anonImport.status).toBe(401);

    const created = await register("second@example.com");
    const session = cookie(created);
    const projectRes = await SELF.fetch("https://obscurus.test/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ name: "Bad" }),
    });
    const project = ((await projectRes.json()) as { project: { id: string } }).project;
    const blocked = await SELF.fetch("https://obscurus.test/v1/endpoints", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({
        project_id: project.id,
        name: "ssrf",
        method: "GET",
        url: "https://127.0.0.1/secret",
        input_schema: { fields: [] },
        price_amount: "0.01",
      }),
    });
    expect(blocked.status).toBe(400);
  });

  it("rejects a second merchant from reading another tenant", async () => {
    const first = await register("one@example.com");
    const firstCookie = cookie(first);
    const projectRes = await SELF.fetch("https://obscurus.test/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: firstCookie },
      body: JSON.stringify({ name: "Private" }),
    });
    const project = ((await projectRes.json()) as { project: { id: string } }).project;
    const endpointRes = await SELF.fetch("https://obscurus.test/v1/endpoints", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: firstCookie },
      body: JSON.stringify({
        project_id: project.id,
        name: "lookup",
        method: "GET",
        url: "https://example.com/",
        input_schema: { fields: [] },
        price_amount: "0.01",
      }),
    });
    expect(endpointRes.status).toBe(201);
    const endpoint = ((await endpointRes.json()) as { endpoint: { id: string } }).endpoint;

    const second = await register("two@example.com");
    const stolen = await SELF.fetch(`https://obscurus.test/v1/endpoints/${endpoint.id}`, {
      headers: { cookie: cookie(second) },
    });
    expect(stolen.status).toBe(404);
  });
});

describe("payment state machine", () => {
  it("requires payment, verifies and fulfills idempotently, and hides wallets", async () => {
    const created = await register("payer@example.com");
    const session = cookie(created);
    const projectRes = await SELF.fetch("https://obscurus.test/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ name: "Paid" }),
    });
    const project = ((await projectRes.json()) as { project: { id: string } }).project;
    const endpointRes = await SELF.fetch("https://obscurus.test/v1/endpoints", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({
        project_id: project.id,
        name: "lookup",
        method: "GET",
        url: "https://example.com/",
        input_schema: { fields: [] },
        price_amount: "0.25",
      }),
    });
    const endpoint = ((await endpointRes.json()) as { endpoint: { id: string } }).endpoint;

    const invoked = await SELF.fetch("https://obscurus.test/v1/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint_id: endpoint.id, input: {} }),
    });
    expect(invoked.status).toBe(201);
    const started = (await invoked.json()) as {
      payment: { id: string; state: string; checkout_url: string };
      invocation: { status: string };
    };
    expect(started.payment.state).toBe("AWAITING_PAYMENT");
    expect(started.invocation.status).toBe("AWAITING_PAYMENT");
    expect(started.payment.checkout_url).toBe(`/pay/${started.payment.id}`);
    expect(JSON.stringify(started)).not.toMatch(/wallet|0x[a-fA-F0-9]{40}/);

    const settle = await SELF.fetch("https://obscurus.test/v1/auth/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ settlement_address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" }),
    });
    expect(settle.status).toBe(200);

    const publicPay = await SELF.fetch(`https://obscurus.test/v1/pay/${started.payment.id}`);
    const publicJson = (await publicPay.json()) as {
      payment: { service_name: string; settlement_address: string };
    };
    expect(publicJson.payment.service_name).toBe("lookup");

    const htmlLogo = await SELF.fetch("https://obscurus.test/v1/branding", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ display_name: "<script>x</script>" }),
    });
    expect(htmlLogo.status).toBe(400);

    const named = await SELF.fetch("https://obscurus.test/v1/branding", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ display_name: "Paid Lookup" }),
    });
    expect(named.status).toBe(200);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const uploaded = await SELF.fetch("https://obscurus.test/v1/branding/logo", {
      method: "PUT",
      headers: { "content-type": "image/png", cookie: session },
      body: png,
    });
    expect(uploaded.status).toBe(200);
    const branding = (await uploaded.json()) as { branding: { logo_url: string; disclosures_required: boolean } };
    expect(branding.branding.disclosures_required).toBe(true);
    const logo = await SELF.fetch(`https://obscurus.test${branding.branding.logo_url}`);
    expect(logo.status).toBe(200);
    expect(logo.headers.get("content-type")).toBe("image/png");
    expect(publicJson.payment.settlement_address).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
    expect(JSON.stringify(publicJson)).not.toMatch(/customer_wallet|payer/);

    const preflight = await SELF.fetch(`https://obscurus.test/v1/pay/${started.payment.id}`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "GET" },
    });
    expect(preflight.headers.get("access-control-allow-origin")).toBeTruthy();

    const unpaidFulfill = await SELF.fetch(`https://obscurus.test/v1/pay/${started.payment.id}/fulfill`, {
      method: "POST",
    });
    expect(unpaidFulfill.status).toBe(409);

    const listed = await SELF.fetch("https://obscurus.test/v1/payments", { headers: { cookie: session } });
    expect(listed.status).toBe(200);
    const listedJson = await listed.json();
    expect(JSON.stringify(listedJson)).not.toMatch(/wallet|address|0x[a-fA-F0-9]{40}/);

    const pendingVerify = await SELF.fetch(`https://obscurus.test/v1/pay/${started.payment.id}/verify`, {
      method: "POST",
    });
    expect(((await pendingVerify.json()) as { matched: boolean }).matched).toBe(false);

    const complete = await SELF.fetch(`https://obscurus.test/v1/pay/${started.payment.id}/mock-complete`, {
      method: "POST",
    });
    expect(complete.status).toBe(200);

    const firstVerify = await SELF.fetch(`https://obscurus.test/v1/pay/${started.payment.id}/verify`, {
      method: "POST",
    });
    const verified = (await firstVerify.json()) as { matched: boolean; payment: { state: string } };
    expect(verified.matched).toBe(true);
    expect(verified.payment.state).toBe("PAID");

    const secondVerify = await SELF.fetch(`https://obscurus.test/v1/pay/${started.payment.id}/verify`, {
      method: "POST",
    });
    expect(((await secondVerify.json()) as { payment: { state: string } }).payment.state).toBe("PAID");

    const firstFulfill = await SELF.fetch(`https://obscurus.test/v1/pay/${started.payment.id}/fulfill`, {
      method: "POST",
    });
    expect(firstFulfill.status).toBe(200);
    const fulfilled = (await firstFulfill.json()) as {
      payment: { state: string };
      invocation: { id: string; status: string; http_status: number };
    };
    expect(fulfilled.payment.state).toBe("FULFILLED");
    expect(fulfilled.invocation.status).toBe("FULFILLED");

    const secondFulfill = await SELF.fetch(`https://obscurus.test/v1/pay/${started.payment.id}/fulfill`, {
      method: "POST",
    });
    expect(secondFulfill.status).toBe(200);
    const again = (await secondFulfill.json()) as { invocation: { id: string; status: string } };
    expect(again.invocation.id).toBe(fulfilled.invocation.id);
    expect(again.invocation.status).toBe("FULFILLED");

    const other = await register("other-pay@example.com");
    const stolen = await SELF.fetch(`https://obscurus.test/v1/payments/${started.payment.id}`, {
      headers: { cookie: cookie(other) },
    });
    expect(stolen.status).toBe(404);
  });
});

describe("telegram adapter", () => {
  it("stores a bot token as a hint, charges, then resumes the same invocation", async () => {
    const created = await register("telegram@example.com");
    const session = cookie(created);
    const projectRes = await SELF.fetch("https://obscurus.test/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ name: "Telegram" }),
    });
    const project = ((await projectRes.json()) as { project: { id: string } }).project;
    const endpointRes = await SELF.fetch("https://obscurus.test/v1/endpoints", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({
        project_id: project.id,
        name: "person search",
        method: "GET",
        url: "https://example.com/",
        input_schema: { fields: [{ name: "query", type: "string", required: true }] },
        price_amount: "0.50",
      }),
    });
    const endpoint = ((await endpointRes.json()) as { endpoint: { id: string } }).endpoint;
    const token = "123456:AAHsecretTOKENVALUE";

    const connected = await SELF.fetch("https://obscurus.test/v1/integrations/telegram", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({
        project_id: project.id,
        endpoint_id: endpoint.id,
        mapping: "/search {{query}}",
        bot_token: token,
      }),
    });
    expect(connected.status).toBe(201);
    const integration = (
      (await connected.json()) as {
        integration: { id: string; token_hint: string; webhook_secret: string; command: string };
      }
    ).integration;
    expect(integration.command).toBe("/search");
    expect(integration.token_hint).toBe("••••ALUE");
    expect(JSON.stringify(integration)).not.toContain(token);

    const listed = await SELF.fetch("https://obscurus.test/v1/integrations/telegram", {
      headers: { cookie: session },
    });
    const listedJson = await listed.json();
    expect(JSON.stringify(listedJson)).not.toContain(token);
    expect(JSON.stringify(listedJson)).not.toContain("webhook_secret");

    const denied = await SELF.fetch(`https://obscurus.test/v1/telegram/webhook/${integration.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: { chat: { id: 99 }, text: "/search John Smith" } }),
    });
    expect(denied.status).toBe(401);

    const webhook = await SELF.fetch(`https://obscurus.test/v1/telegram/webhook/${integration.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": integration.webhook_secret,
      },
      body: JSON.stringify({ message: { chat: { id: 4242 }, text: "/search John Smith" } }),
    });
    expect(webhook.status).toBe(200);
    const started = (await webhook.json()) as {
      obscurus: { invocation_id: string; checkout_url: string; replied: string };
    };
    expect(started.obscurus.replied).toBe("payment_required");
    expect(started.obscurus.checkout_url).toMatch(/^\/pay\//);
    const paymentId = started.obscurus.checkout_url.slice("/pay/".length);

    const invocations = await SELF.fetch("https://obscurus.test/v1/invocations", { headers: { cookie: session } });
    const invocationJson = (await invocations.json()) as {
      invocations: { id: string; source: string; input: { query: string }; status: string }[];
    };
    expect(invocationJson.invocations[0]?.id).toBe(started.obscurus.invocation_id);
    expect(invocationJson.invocations[0]?.source).toBe("telegram");
    expect(invocationJson.invocations[0]?.input).toEqual({ query: "John Smith" });
    expect(JSON.stringify(invocationJson)).not.toContain("4242");
    expect(JSON.stringify(invocationJson)).not.toContain(token);

    await SELF.fetch(`https://obscurus.test/v1/pay/${paymentId}/mock-complete`, { method: "POST" });
    await SELF.fetch(`https://obscurus.test/v1/pay/${paymentId}/verify`, { method: "POST" });
    const fulfilled = await SELF.fetch(`https://obscurus.test/v1/pay/${paymentId}/fulfill`, { method: "POST" });
    expect(fulfilled.status).toBe(200);
    const done = (await fulfilled.json()) as {
      telegram: { delivered: boolean };
      invocation: { id: string; status: string };
    };
    expect(done.invocation.id).toBe(started.obscurus.invocation_id);
    expect(done.invocation.status).toBe("FULFILLED");
    expect(done.telegram.delivered).toBe(true);
    expect(JSON.stringify(done)).not.toContain("4242");
  });
});

describe("mcp adapter", () => {
  it("lists the same endpoint as a tool and refuses silent spend", async () => {
    const created = await register("mcp@example.com");
    const session = cookie(created);
    const projectRes = await SELF.fetch("https://obscurus.test/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ name: "MCP" }),
    });
    const project = ((await projectRes.json()) as { project: { id: string } }).project;
    const endpointRes = await SELF.fetch("https://obscurus.test/v1/endpoints", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({
        project_id: project.id,
        name: "person search",
        method: "GET",
        url: "https://example.com/",
        input_schema: { fields: [{ name: "query", type: "string", required: true }] },
        price_amount: "0.50",
      }),
    });
    expect(endpointRes.status).toBe(201);

    const listed = await SELF.fetch("https://obscurus.test/v1/integrations/mcp", { headers: { cookie: session } });
    expect(listed.status).toBe(200);
    const servers = ((await listed.json()) as { servers: { url: string }[] }).servers;
    expect(servers[0]?.url).toContain(`/v1/mcp/${project.id}`);

    const tools = await SELF.fetch(`https://obscurus.test/v1/mcp/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    const toolJson = (await tools.json()) as {
      result: { tools: { name: string; _meta: { obscurus: { silent_spend: boolean; amount: string } } }[] };
    };
    expect(toolJson.result.tools[0]?.name).toBe("person_search");
    expect(toolJson.result.tools[0]?._meta.obscurus.silent_spend).toBe(false);
    expect(JSON.stringify(toolJson)).not.toMatch(/wallet|0x[a-fA-F0-9]{40}/);

    const silent = await SELF.fetch(`https://obscurus.test/v1/mcp/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "person_search", arguments: { query: "John" }, paid: true },
      }),
    });
    expect(silent.status).toBe(400);
    expect(JSON.stringify(await silent.json())).toContain("silent_spend_forbidden");

    const called = await SELF.fetch(`https://obscurus.test/v1/mcp/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "person_search", arguments: { query: "John" } },
      }),
    });
    expect(called.status).toBe(200);
    const required = (await called.json()) as {
      result: { isError: boolean; structuredContent: { error: string; payment: { id: string; checkout_url: string } } };
    };
    expect(required.result.isError).toBe(true);
    expect(required.result.structuredContent.error).toBe("payment_required");
    const paymentId = required.result.structuredContent.payment.id;

    await SELF.fetch(`https://obscurus.test/v1/pay/${paymentId}/mock-complete`, { method: "POST" });
    await SELF.fetch(`https://obscurus.test/v1/pay/${paymentId}/verify`, { method: "POST" });

    const authorized = await SELF.fetch(`https://obscurus.test/v1/mcp/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "person_search", arguments: { query: "John" }, payment_id: paymentId },
      }),
    });
    expect(authorized.status).toBe(200);
    const done = (await authorized.json()) as { result: { isError: boolean; structuredContent: { status: string } } };
    expect(done.result.isError).toBe(false);
    expect(done.result.structuredContent.status).toBe("FULFILLED");
  });
});

describe("http 402", () => {
  it("returns Obscurus-native payment_required then the result after pay", async () => {
    const created = await register("http402@example.com");
    const session = cookie(created);
    const projectRes = await SELF.fetch("https://obscurus.test/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ name: "HTTP" }),
    });
    const project = ((await projectRes.json()) as { project: { id: string } }).project;
    const endpointRes = await SELF.fetch("https://obscurus.test/v1/endpoints", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({
        project_id: project.id,
        name: "person search",
        method: "GET",
        url: "https://example.com/",
        input_schema: { fields: [{ name: "query", type: "string", required: true }] },
        price_amount: "0.50",
      }),
    });
    expect(endpointRes.status).toBe(201);

    const first = await SELF.fetch("https://obscurus.test/v1/invoke/person_search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "John" }),
    });
    expect(first.status).toBe(402);
    const required = (await first.json()) as {
      error: string;
      payment: { id: string; amount: string; asset: string; checkout_url: string };
    };
    expect(required.error).toBe("payment_required");
    expect(required.payment.amount).toBe("0.50");
    expect(required.payment.asset).toBe("USDC");
    expect(required.payment.checkout_url).toBe(`/pay/${required.payment.id}`);
    expect(JSON.stringify(required)).not.toMatch(/wallet|PAYMENT-SIGNATURE|0x[a-fA-F0-9]{40}/);

    await SELF.fetch(`https://obscurus.test/v1/pay/${required.payment.id}/mock-complete`, { method: "POST" });
    await SELF.fetch(`https://obscurus.test/v1/pay/${required.payment.id}/verify`, { method: "POST" });

    const second = await SELF.fetch("https://obscurus.test/v1/invoke/person_search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "John", payment_id: required.payment.id }),
    });
    expect(second.status).toBe(200);
    const paid = (await second.json()) as { result: unknown };
    expect(paid).toHaveProperty("result");
  });
});

describe("webhooks", () => {
  it("signs deliveries without wallets and retries from the merchant API", async () => {
    const created = await register("hooks@example.com");
    const session = cookie(created);
    const projectRes = await SELF.fetch("https://obscurus.test/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ name: "Hooks" }),
    });
    const project = ((await projectRes.json()) as { project: { id: string } }).project;
    const secret = "should-not-leak-after-create";
    const hookRes = await SELF.fetch("https://obscurus.test/v1/webhooks", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ project_id: project.id, url: "https://example.com/hooks" }),
    });
    expect(hookRes.status).toBe(201);
    const createdHook = (await hookRes.json()) as {
      webhook: { id: string; secret: string; secret_hint: string };
      verify: { headers: { "X-Obscurus-Signature": string } };
    };
    expect(createdHook.webhook.secret.startsWith("whsec_")).toBe(true);
    expect(createdHook.verify.headers["X-Obscurus-Signature"].startsWith("sha256=")).toBe(true);

    const listed = await SELF.fetch("https://obscurus.test/v1/webhooks", { headers: { cookie: session } });
    const listedJson = await listed.json();
    expect(JSON.stringify(listedJson)).not.toContain(createdHook.webhook.secret);
    expect(JSON.stringify(listedJson)).not.toContain(secret);

    await SELF.fetch("https://obscurus.test/v1/endpoints", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({
        project_id: project.id,
        name: "person search",
        method: "GET",
        url: "https://example.com/",
        input_schema: { fields: [] },
        price_amount: "0.25",
      }),
    });
    const endpoints = await SELF.fetch("https://obscurus.test/v1/endpoints", { headers: { cookie: session } });
    const endpoint = ((await endpoints.json()) as { endpoints: { id: string }[] }).endpoints[0];
    await SELF.fetch("https://obscurus.test/v1/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint_id: endpoint?.id, input: {} }),
    });

    const deliveries = await SELF.fetch(`https://obscurus.test/v1/webhooks/${createdHook.webhook.id}/deliveries`, {
      headers: { cookie: session },
    });
    const deliveryJson = (await deliveries.json()) as {
      deliveries: { id: string; event: string; status: string; payload: Record<string, unknown> }[];
    };
    expect(deliveryJson.deliveries.some((item) => item.event === "payment.created")).toBe(true);
    expect(JSON.stringify(deliveryJson)).not.toMatch(/wallet|0x[a-fA-F0-9]{40}/);

    const retry = await SELF.fetch(
      `https://obscurus.test/v1/webhooks/deliveries/${deliveryJson.deliveries[0]?.id}/retry`,
      { method: "POST", headers: { cookie: session } },
    );
    expect(retry.status).toBe(200);
    expect(((await retry.json()) as { delivery: { status: string } }).delivery.status).toBe("delivered");
  });
});

