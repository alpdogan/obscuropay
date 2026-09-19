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

