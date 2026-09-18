# Glossary

Terms below are used with these meanings across the architecture book. Prefer these words in code, APIs, logs, and UI copy.

## Product

**Obscurus** — the platform.

**Obscurus Pay** — the primary product: payment and entitlement for monetized APIs.

**Obscurus Checkout** — the hosted payment page at `/pay/{payment_id}`.

**Obscurus Gateway** — the public invocation surface (HTTP, Telegram, MCP). A logical role inside the platform Worker, not a separate company or chain.

**Obscurus Protocol** — the invocation and payment contracts described in this book. Not a token.

## People and systems

**Merchant** — the account that owns projects, endpoints, and settlement configuration.

**Customer** — a human or agent that invokes a paid endpoint. Customers do not need an Obscurus account in the MVP.

**Agent** — autonomous software that invokes tools through MCP or HTTP. Same payment and entitlement model as a human.

**Merchant API** — the merchant’s existing HTTP service. Obscurus calls it only after an entitlement exists.

## Domain

**Project** — a merchant’s namespace for endpoints, integrations, and branding.

**Endpoint** — a monetized HTTP operation (for example `person_search`).

**EndpointVersion** — an immutable published snapshot of an endpoint’s URL template, headers, input schema, pricing, and response mapping. Edits create a new version.

**InputSchema** — the fields a customer must supply. Types in the MVP: `string`, `number`, `boolean`, `enum`.

**PricingRule** — how an invocation is priced. MVP implements `PER_REQUEST` only. `CREDIT_PACK`, `SUBSCRIPTION`, and `ONE_TIME_UNLOCK` are reserved in the schema and unimplemented.

**Invocation** — one attempt to run an endpoint through any adapter. All channels become invocations.

**Payment** — the record of a charge, with a state machine. See [Payment flow](../protocol/payment-flow.md).

**Entitlement** — the right to fulfill one (or a defined number of) invocations. A single-use entitlement cannot execute twice.

**Integration** — a channel binding: Telegram bot, MCP server, or HTTP 402 route.

**Webhook** — an optional merchant callback for platform events. Signed. Never a source of payment truth.

**Settlement** — delivery of received funds to the merchant’s on-chain destination.

**Secret** — a credential (API key, bot token, webhook secret) stored through SecretProvider. Never returned in full after write.

**AuditEvent** — an append-only record of a sensitive action.

**BrandingConfiguration** — merchant checkout appearance. Cannot include arbitrary HTML, CSS, or JavaScript. Cannot hide Obscurus privacy disclosures.

## Identity

**Service identity** — who is calling on a channel: a Telegram chat, an MCP session, an HTTP caller. Stored for adapter resume. Not shown to the merchant by default.

**Payment identity** — who paid: wallet address, transaction hash, chain. Stored for verification. Not shown to the merchant by default.

**Fulfillment data** — what the merchant needs: `request_id`, customer input, payment verified/amount/asset, entitlement id.

**paymentRef** — opaque on-chain bytes used to correlate a blockchain transfer with an Obscurus payment. Never derived from Telegram IDs, emails, query text, or merchant URLs.

Obscurus may join these domains internally so an invocation can resume after payment. Merchant APIs, dashboards, and webhooks must not.

## Runtime

**Platform Worker** — the Cloudflare Worker that serves merchant API routes, public gateway routes, queue consumers, and cron.

**Adapter** — code that translates Telegram, MCP, or HTTP into the invocation pipeline. Adapters do not contain payment or entitlement logic.

**PaymentProvider** — domain interface: `CreatePayment`, `VerifyPayment`, `GetPayment`. Optional later: `Refund`. No EVM types leak into this interface.

**SecretProvider** — domain interface for encrypting, storing, and fetching secrets. Development uses local encrypted storage. Production uses Cloudflare Secrets Store for key-encryption keys and D1 for ciphertext.

**HTTP executor** — the only component allowed to call a merchant API. Parses structured requests. Never shells out to `curl`. Enforces SSRF policy.

## Cloudflare primitives

**D1** — SQLite database. System of record for domain entities.

**KV** — eventually consistent key-value store. Rate limits, short-lived checkout tokens, idempotency keys with TTL. Not business truth.

**Durable Object** — strongly consistent per-entity isolate. One object per `payment_id` or `invocation_id` for state transitions, expiry alarms, and double-fulfillment locks.

**Queue** — asynchronous work: payment verification, invocation resume, webhook delivery.

**R2** — object storage for merchant logos and other binary branding assets.

**Secrets Store** — platform secret material. Merchant secrets are never written here in plaintext as a shared blob; they are encrypted per tenant.

**Wrangler** — CLI for local Miniflare development and deployment.

## Payment states

Used in APIs and D1 as these exact strings:

`CREATED` → `AWAITING_PAYMENT` → `CONFIRMING` → `PAID` → `FULFILLING` → `FULFILLED`

Terminal branches: `FAILED`, `EXPIRED`, `REFUNDED`.
