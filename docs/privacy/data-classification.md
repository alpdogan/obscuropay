# Data classification

Classification drives storage, logs, APIs, and retention. If a field has no class, do not persist it.

## Classes

**C0 — Public.** Marketing copy, endpoint name, price, asset, public docs.

**C1 — Merchant confidential.** Endpoint URLs, response mappings, settlement address, revenue aggregates. Visible to that merchant. Not public.

**C2 — Secret.** Merchant API keys, Telegram bot tokens, webhook HMAC keys, platform KEKs, chain indexer credentials, private keys. Plaintext only via SecretProvider in memory. Never in D1 plaintext, never in logs, never in browsers.

**C3 — Fulfillment.** Customer inputs, transformed outputs, `request_id`, entitlement id, verified amount and asset. Visible to the merchant because they need it to serve. Short TTL for bulky bodies (proposed 7 days, then hash).

**C4 — Service identity.** Telegram user or chat ids, MCP session ids, IP addresses, User-Agent. Adapter-private. Hashed or opaque in D1. Not in merchant APIs by default. Not in default logs.

**C5 — Payment identity.** Wallet address, tx hash, WalletConnect topic. Verification-private. Not in merchant APIs by default. Not in default logs. Full address in restricted columns only.

**C6 — Blockchain public.** Once a transaction is included, payer, payee, amount, and calldata are public to the world. Obscurus cannot reclassify C6 as C5 by omitting a JSON field.

**C7 — Audit.** Who changed settlement, who viewed a secret metadata record, admin actions. Long-lived. Minimize C4/C5 inside audit payloads (actor is a merchant or admin id, not a customer wallet).

## Field map (MVP)

| Field | Class | Persist | Merchant API | Default logs |
| ----- | ----- | ------- | ------------ | ------------ |
| Endpoint name, price | C0 / C1 | D1 | Yes | Yes |
| Merchant API URL | C1 | D1 | Yes (owner) | No |
| Bot token / API key | C2 | Ciphertext D1 | Redacted | Never |
| Input body | C3 | D1, short TTL | Yes | No |
| `request_id` | C3 | D1 | Yes | Yes |
| Amount, asset, payment state | C3 | D1 | Yes | Yes |
| Telegram user id | C4 | Hash / adapter table | No | No |
| Payer wallet | C5 | Restricted column | No | No |
| `paymentRef` | C3 / C6 | D1 + chain | Yes (opaque) | Yes |
| Tx hash | C5 / C6 | Restricted; public on chain | No by default | No |
| Settlement address | C1 / C6 | D1; public on chain | Yes (owner) | No |

## Never persist plaintext

- Merchant API keys
- Telegram bot tokens
- Signing keys and wallet mnemonics (Obscurus holds none for customers in the MVP)
- Webhook secrets
- Card data (out of scope forever for in-house storage)

## Never log

- C2 fields
- `Authorization` and `Cookie` headers
- Raw cURL pastes
- Full C4 and C5 identifiers
- Request bodies unless a time-boxed debug flag is on

Allowed log fields: `request_id`, `trace_id`, `merchant_id`, `endpoint_id`, `payment_id`, `invocation_id`, status, error class, latency.

## Access

- Merchant role: C0, C1, C3 for self.
- Adapter code: C4 for the current invocation only.
- Payment verifier: C5 for the current payment only.
- Support / admin: no default C4/C5. Break-glass with AuditEvent.

## Deletion

Merchant-initiated delete of a project must remove C3 bodies and disable integrations. C7 may remain. C2 ciphertext is deleted or cryptographically orphaned. Chain history (C6) cannot be deleted.

## Mapping to Cloudflare stores

| Store | Allowed classes | Notes |
| ----- | --------------- | ----- |
| D1 | C0–C7 as columns obeying this table | Parameterized SQL; tenant predicates |
| KV | C0, coordination tokens | TTL; no C2 plaintext |
| Durable Object | In-flight C3 ids, state | Not a secret cabinet |
| R2 | C1 logos | MIME validation |
| Queues | Identifiers (ids), not C2 | Messages can be logged by the platform — keep payloads minimal |
| Secrets Store | C2 KEKs | Not merchant secret bulk storage |
| Workers traces | Same as logs | Redact |

## Conflicts

If a debugger wants a body and classification says no, classification wins. Add a documented, expiring exception — do not “just log it.”
