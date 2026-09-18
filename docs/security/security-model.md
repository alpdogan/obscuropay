# Security model

Security is a product requirement, not a later hardening pass. This document states controls. The [threat model](threat-model.md) maps attacks to those controls. Nothing here is implemented until later phases; Phase 0 freezes the rules.

## Goals

1. Merchant APIs execute only after a server-side entitlement exists.
2. Secrets never appear in browsers, MCP results, Telegram messages, or default logs.
3. Payment truth is not a client flag.
4. Merchant-defined HTTP is SSRF-constrained.
5. Webhooks are authenticable and replay-resistant.
6. Tenants cannot read each other.
7. Claims in the UI match these controls.

## Authentication and authorization

- Merchants authenticate to the merchant API (Phase 1: email and password, HTTP-only session).
- Customers do not create Obscurus accounts in the MVP.
- Every merchant query is scoped by `merchant_id`. There is no unscoped “list payments.”
- Platform admin, when it exists, is a separate role with AuditEvents. It is not the merchant dashboard with a hidden flag.
- Capability tokens for HTTP invoke (if issued) are not wallet addresses and are not Telegram IDs.

## Secrets

SecretProvider is the only read path for plaintext merchant credentials.

- Encrypt before D1. KEK from Secrets Store (production) or `.dev.vars` (local).
- APIs return metadata and last-four / prefix hints, never the full secret after insert.
- Telegram bot tokens, merchant `Authorization` values, webhook HMAC keys, and chain indexer credentials are secrets.
- Checkout, dashboard JavaScript, and MCP tool schemas must not embed them.
- Compare secrets with `timingSafeEqual`. Generate IDs with `crypto.randomUUID()` or `crypto.getRandomValues()`, never `Math.random()`.

## Payment integrity

- `paymentRef` is unique in D1 and on-chain.
- `VerifyPayment` is idempotent. Duplicate events do not create a second entitlement.
- Fulfillment is claimed by the invocation Durable Object once.
- Amount and asset on-chain must match the payment row.
- Checkout may display status. Only the platform Worker may change payment state.
- MockPaymentProvider is forbidden in production environments.

## HTTP executor and SSRF

Merchant URLs are untrusted.

The executor:

- Parses a structured request. Never runs a shell.
- Allows `https` only in production. `http` may be allowed for explicit local allowlisted hosts in development.
- Allows an explicit method list (MVP: GET, POST, PUT, PATCH, DELETE as configured on the endpoint — not CONNECT, not TRACE).
- Rejects localhost, loopback, RFC1918, link-local, unique local (IPv6), and cloud metadata hostnames and IP literals.
- Resolves DNS (DNS-over-HTTPS is acceptable) and **re-validates IPs** before connect. Re-check on every redirect hop.
- Caps redirects, time, and response bytes. Stream bodies; do not `await response.text()` on unbounded data.
- Does not follow redirects to a blocked IP.
- Blocks hostnames used for metadata (`169.254.169.254`, `metadata.google.internal`, and equivalents).
- Applies per-endpoint and per-merchant rate limits (KV).

Workers `fetch` is not a substitute for this policy.

## Webhooks

- HMAC signature over timestamp + body (`X-Obscurus-Signature`, `X-Obscurus-Timestamp`).
- Reject skew outside tolerance.
- Idempotency key per event delivery.
- Bounded retries with exponential backoff on a Queue. Dead-letter after N failures, visible in the dashboard.
- Merchants verify signatures. Obscurus never documents “trust `paid=true` in the JSON without signature.”

## Frontend

- No arbitrary merchant HTML, CSS, or JavaScript on checkout.
- Logos: MIME allowlist, size and dimension limits, stored on R2, served with safe `Content-Type`.
- Mandatory privacy disclosure cannot be removed.
- Dependency pins and lockfiles. Later: supply-chain scanning. Treat checkout WalletConnect scripts as trusted computing base.

## Cloudflare configuration

- `compatibility_date` current; `nodejs_compat` as required.
- `observability` enabled.
- Secrets via `wrangler secret` / Secrets Store, never in `wrangler.jsonc` or git.
- Env types from `wrangler types`, not hand-written `any`.
- No `passThroughOnException`.
- No module-level request state.
- Every Promise is awaited, returned, or `ctx.waitUntil`’d. Do not destructure `waitUntil` off `ctx`.
- Bindings over Cloudflare REST API from inside the Worker.

## Smart contracts (Phase 5+)

- Checks-Effects-Interactions.
- Unique `paymentRef`.
- No upgradeable proxy in v1.
- No owner sweep of customer funds.
- Document every admin capability in the contract README.
- Independent audit required before mainnet.
- Test: wrong amount, duplicate reference, fee math, reentrancy, odd ERC-20 behavior.

## Logging and traces

Policy in [data classification](../privacy/data-classification.md). Default logs are identifiers and error classes, not bodies and not secrets. Workers traces use request IDs already in this policy.

## Incident assumptions

If the Cloudflare account, Wrangler token, or D1 snapshot leaks, treat all service and payment identity as correlatable by the attacker. Rotate KEKs, sessions, webhook secrets, and bot tokens. That event is a platform breach, not a “merchant privacy feature failed.” Merchant-facing redaction does not protect against us.
