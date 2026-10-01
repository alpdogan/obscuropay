# Merchant API (Phase 1–14)

The merchant control plane, cURL importer, response mapping, payment/entitlement state machine, checkout APIs, the Next.js merchant dashboard, Telegram, MCP, HTTP 402, and signed webhooks. With `PAY_CONTRACT` set, verify reads Base Sepolia `PaymentReceived` logs. Without it, the D1-backed mock provider is used and `POST /v1/pay/:id/mock-complete` is refused in production. `MockPaymentProvider` remains the in-memory unit-test double. `ObscurusPay` is not deployed by this repository and must not be deployed to mainnet.

Base path: `/v1`. JSON in, JSON out. Sessions use the `obscurus_session` HTTP-only cookie. `GET /health` and `GET /ready` are unauthenticated. Every response includes `X-Request-Id`. See [observability](observability.md).

## Endpoints

**Auth**

- `POST /v1/auth/register` `{ email, password }`
- `POST /v1/auth/login` `{ email, password }`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`
- `PATCH /v1/auth/me` `{ settlement_address }` — merchant destination for Base Sepolia USDC. Not a customer wallet.

**Projects**

- `POST /v1/projects` `{ name }`
- `GET /v1/projects`

**cURL importer**

- `POST /v1/curl/import` `{ curl }` — parse only. Secret header values are masked. Never executed as a shell command.
- `POST /v1/endpoints/from-curl` `{ project_id, curl, name, customer_fields, price_amount, price_asset }` — stores detected secrets, maps selected JSON fields to `{{input.*}}`, creates the endpoint. SSRF still applies to the URL.

**Endpoints**

- `POST /v1/endpoints`
- `GET /v1/endpoints`
- `GET /v1/endpoints/:id`
- `PATCH /v1/endpoints/:id`
- `POST /v1/endpoints/:id/test` `{ input }`
- `POST /v1/endpoints/:id/preview-response` `{ sample, mapping? }` — applies passthrough, JSONPath-style `select`, or a text `template` to a sample merchant response.

**Secrets**

- `POST /v1/secrets` `{ project_id, name, value }`
- `GET /v1/secrets?project_id=`

After write, only `hint` is returned. Plaintext is never listed.

**Invocations**

- `GET /v1/invocations`
- `GET /v1/invocations/:id`

**Payments (merchant)**

- `GET /v1/payments`
- `GET /v1/payments/:id`

Merchant payment JSON is `id`, `endpoint_id`, `invocation_id`, `amount`, `asset`, `state`, `payment_ref`, `provider`, `expires_at`, `checkout_url`, timestamps. It never includes a wallet, address, or transaction identity.

**Branding**

- `GET /v1/branding`
- `PATCH /v1/branding` `{ display_name }` — plain text only. HTML, CSS, and JavaScript are rejected.
- `PUT /v1/branding/logo` raw PNG/JPEG/WebP, max 256 KiB. Magic bytes must match `Content-Type`. Small logos persist in D1; R2 remains the documented production object store.
- `GET /v1/logos/:merchant_id` — public image.

There is no field to hide Obscurus disclosures. `disclosures_required` is always `true`.

**Telegram**

- `POST /v1/integrations/telegram` `{ project_id, endpoint_id, command?, input_field?, mapping?, bot_token }` — stores the bot token as a secret. Only `token_hint` is shown later. `webhook_secret` is returned on this write so the merchant can confirm `setWebhook`.
- `GET /v1/integrations/telegram` — command, hint, webhook URL. Never the token.
- `POST /v1/telegram/webhook/:id` — Telegram update receiver. Creates the invocation, sends checkout, and after fulfill replies in the same chat.

See [Telegram adapter](telegram.md).

**MCP**

- `GET /v1/integrations/mcp` — per-project JSON-RPC URL. Spending policy is documented, not auto-spent.
- `POST /v1/mcp/:projectId` — `tools/list` and `tools/call`. Calls without `payment_id` return `payment_required`. `paid=true` is rejected.

See [MCP adapter](mcp.md).

**Webhooks**

- `POST /v1/webhooks` `{ project_id, url, events? }` — returns the HMAC secret once plus a verification example.
- `GET /v1/webhooks` — URL, events, secret hint, last delivery health.
- `GET /v1/webhooks/:id/deliveries`
- `POST /v1/webhooks/deliveries/:id/retry`

See [Webhooks](webhooks.md). Deliveries are signed with `X-Obscurus-Signature` and `X-Obscurus-Timestamp`. Payloads never include a customer wallet by default.

**Paid invoke (no customer account)**

- `POST /v1/invoke` `{ endpoint_id, input }` — creates an invocation and a `CREATED` → `AWAITING_PAYMENT` charge. `PER_REQUEST` only. Returns `201` for existing clients.
- `POST /v1/invoke/:slug` `{ query…, payment_id? }` — Obscurus-native **HTTP 402** `payment_required` until a `payment_id` is authorized, then `200 { result }`. See [HTTP 402](http-402.md).
- `GET /v1/pay/:id` — public checkout payload: amount, asset, state, `payment_ref`, `service_name`, merchant `settlement_address`. Never a customer wallet.
- `POST /v1/pay/:id/verify` — idempotent. Issues a single-use entitlement when the payment becomes `PAID`.
- `POST /v1/pay/:id/fulfill` — claims the entitlement and runs the merchant API at most once.
- `POST /v1/pay/:id/mock-complete` — development only. Marks the next verify as matched. Forbidden in production.

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
  "price_asset": "USDC",
  "response": { "mode": "passthrough" }
}
```

`url` is static. Customer input is interpolated only in `body_template` via `{{input.field}}`. The URL is checked against the SSRF policy at write time. Test invokes resolve secrets in memory, call the merchant API, apply the stored response mapping, and record an invocation. They do not take a client `paid` flag and do not skip SSRF.

## Response mapping

Merchants choose how customers see a successful merchant API body. Templates cannot execute JavaScript.

| Mode | Behavior |
| ---- | -------- |
| `passthrough` | Return the merchant body unchanged. Default. |
| `jsonpath` | Select one JSON value with `select` (`$.data.name`, `data.items[0]`). |
| `template` | Interpolate `{{path}}` placeholders from the JSON body. |

`POST /v1/endpoints/:id/preview-response` applies a mapping to a sample (or the stored mapping if omitted) so merchants can inspect output before publishing. Test invokes persist the mapped preview, truncated to 2 KiB.

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

Unresolved: form-urlencoded bodies as customer inputs (JSON only today); nested JSON paths in the importer (top-level keys only).

## Phase 3 notes

Response mapping is stored on the endpoint (`response_mode`, `response_select`, `response_template`). JSONPath is a conservative subset: dotted keys and numeric indexes, optional `$.` prefix. Templates only substitute values; they do not evaluate expressions.

## Phase 4 notes

States: `CREATED` → `AWAITING_PAYMENT` → `CONFIRMING` → `PAID` → `FULFILLING` → `FULFILLED`, plus `FAILED` | `EXPIRED` | `REFUNDED`. `Refund()` is not implemented. `CREDIT_PACK`, `SUBSCRIPTION`, and `ONE_TIME_UNLOCK` are reserved names and rejected at invoke time.

Merchant test invokes (`POST /v1/endpoints/:id/test`) still execute without a payment. Paid traffic must verify, then fulfill. A claimed entitlement cannot run the executor a second time. Merchant API errors fail the invocation and leave the charge `PAID` (no silent refund). Unpaid payments expire after 30 minutes on the next verify.
