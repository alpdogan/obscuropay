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

    const patched = await SELF.fetch(`https://obscurus.test/v1/endpoints/${endpoint.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: session },
      body: JSON.stringify({ price_amount: "0.75" }),
    });
    expect(patched.status).toBe(200);
    const patchedJson = (await patched.json()) as { endpoint: { pricing: { amount: string } } };
    expect(patchedJson.endpoint.pricing.amount).toBe("0.75");

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
