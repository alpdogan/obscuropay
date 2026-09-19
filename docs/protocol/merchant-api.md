# Merchant API (Phase 1)

Phase 1 is the merchant control plane. There is no customer checkout, Telegram, MCP, or on-chain payment yet. Payments exist as a `PaymentProvider` port and an in-memory `MockPaymentProvider` for tests.

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
