# Merchant API (Phase 1–2)

The merchant control plane plus a cURL importer. There is no customer checkout, Telegram, MCP, or on-chain payment yet. Payments exist as a `PaymentProvider` port and an in-memory `MockPaymentProvider` for tests.

Base path: `/v1`. JSON in, JSON out. Sessions use the `obscurus_session` HTTP-only cookie.

## Endpoints

**Auth**

- `POST /v1/auth/register` `{ email, password }`
- `POST /v1/auth/login` `{ email, password }`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`

**Projects**

- `POST /v1/projects` `{ name }`
- `GET /v1/projects`

**cURL importer**

- `POST /v1/curl/import` `{ curl }` — parse only. Secret header values are masked. Never executed as a shell command.
- `POST /v1/endpoints/from-curl` `{ project_id, curl, name, customer_fields, price_amount, price_asset }` — stores detected secrets, maps selected JSON fields to `{{input.*}}`, creates the endpoint. SSRF still applies to the URL.

**Endpoints**

- `POST /v1/endpoints`
- `GET /v1/endpoints/:id`
- `PATCH /v1/endpoints/:id`
- `POST /v1/endpoints/:id/test` `{ input }`

**Secrets**

- `POST /v1/secrets` `{ project_id, name, value }`
- `GET /v1/secrets?project_id=`

After write, only `hint` is returned. Plaintext is never listed.

**Invocations**

- `GET /v1/invocations`
- `GET /v1/invocations/:id`

## Create endpoint body

```json
{
  "project_id": "proj_...",
  "name": "person search",
  "method": "POST",
  "url": "https://api.example.com/search",
  "headers": [{ "name": "Authorization", "secret_id": "sec_..." }],
  "body_template": "{\"query\":\"{{input.query}}\"}",
  "input_schema": { "fields": [{ "name": "query", "type": "string", "required": true }] },
  "price_amount": "0.50",
  "price_asset": "USDC"
}
```

`url` is static. Customer input is interpolated only in `body_template` via `{{input.field}}`. The URL is checked against the SSRF policy at write time. Test invokes resolve secrets in memory, call the merchant API, and record an invocation. They do not take a client `paid` flag and do not skip SSRF.

## Errors

```json
{ "error": { "code": "not_found", "message": "endpoint not found" } }
```

## Local run

Requires Node.js 22 (Wrangler 4).

```bash
pnpm install
cp services/platform/.dev.vars.example services/platform/.dev.vars
pnpm --filter @obscurus/platform dev
```

`SECRET_KEK` must be 32 bytes, base64. Do not commit `.dev.vars`.

## Phase 2 notes

The importer is a parser, not a shell. Pipes, `$(...)`, backticks, and `-o` file writes are ignored or recorded as warnings. They are never executed.

Unresolved: form-urlencoded bodies as customer inputs (JSON only today); nested JSON paths (top-level keys only).
