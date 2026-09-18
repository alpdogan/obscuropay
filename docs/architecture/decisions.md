# Architectural decisions

Proposed ADRs for Phase 0 review. Status on each is **Proposed** until a human accepts it. Implementation of Phase 1 must not start by silently changing these.

Format: Context, Decision, Consequences.

---

## ADR-0001 — TypeScript on Cloudflare Workers

**Status:** Proposed

**Context.** The product hosts on Cloudflare Workers and D1. Workers execute JavaScript and TypeScript in V8 isolates. Go is not a first-class Workers runtime for this application. TinyGo or WASM Go would fight the platform (bindings, D1, Durable Objects, Queues, `nodejs_compat` libraries) and would not improve the domain model.

The original language sketch used Go and PostgreSQL. Hosting overrides that sketch.

**Decision.** Application code is TypeScript. Enable `nodejs_compat`. HTTP uses a small framework suitable for Workers (Hono or equivalent). Tests use Vitest with `@cloudflare/vitest-pool-workers` where bindings matter. Smart contracts stay Solidity in Foundry.

**Consequences.** One language across dashboard, checkout, website, and platform Worker. Domain logic must still be isolated from Cloudflare APIs (`packages/core`). We accept V8 CPU and subrequest limits; long work goes to Queues. We do not run Kubernetes or a Go API in the MVP.

---

## ADR-0002 — One platform Worker

**Status:** Proposed

**Context.** The product has three logical surfaces: merchant API, public gateway, async consumer. Separate microservices add auth, observability, and deploy cost before there is traffic.

**Decision.** Ship one Worker (`services/platform`) with `fetch`, `queue`, and `scheduled` handlers. Keep internal modules for api, gateway, and adapters. Next.js apps are separate Workers via OpenNext or the current Cloudflare Next.js adapter. If we later split, Worker-to-Worker calls use service bindings, not public HTTP.

**Consequences.** One observability stream, one `wrangler.jsonc`, simpler secrets. A bug in gateway code shares a process with the merchant API — mitigated by module boundaries, auth, and tests. Not a license to mix Telegram parsing into entitlement code.

---

## ADR-0003 — D1 is the system of record

**Status:** Proposed

**Context.** Workers should use in-process bindings. D1 is SQLite at the edge. Redis and PostgreSQL would require extra network and operators.

**Decision.** Domain entities persist in D1. KV holds TTL coordination (rate limits, checkout tokens, idempotency keys). Durable Objects, keyed by `payment_id` or `invocation_id`, serialize state transitions and expiry alarms. Queues carry verify, resume, and webhook jobs. R2 stores logos. Secrets Store (or `wrangler secret`) holds platform key-encryption keys.

**Consequences.** SQL dialect is SQLite. Migrations are Wrangler D1 migrations. We do not pretend KV is strongly consistent financial truth. If D1 limits later block the product, moving to Hyperdrive + Postgres is a new ADR. No silent dual-write.

---

## ADR-0004 — Domain package has no Cloudflare imports

**Status:** Proposed

**Context.** Business logic coupled to Telegram, D1, or `fetch` cannot be reused and cannot be tested as rules.

**Decision.** `packages/core` defines entities, the invocation pipeline, PaymentProvider, SecretProvider, and HTTP executor policy as ports. `packages/db` and `services/platform` implement adapters. Integrations are packages called by the gateway, not a second source of payment truth.

**Consequences.** Slightly more interfaces. Prevents the failure mode where Telegram “just marks paid.”

---

## ADR-0005 — Identity domains stay separated

**Status:** Proposed

**Context.** Privacy is data minimization: service identity vs payment identity vs fulfillment data. Obscurus must join them to resume a Telegram chat after payment. Merchants must not receive that join.

**Decision.** Separate tables or columns with access rules. Merchant APIs, list queries, and webhooks select fulfillment data only. Adapter routing data is not in those queries. On-chain data is an opaque `paymentRef` plus settlement fields. See [Privacy model](../privacy/privacy-model.md).

**Consequences.** Internal correlation still exists. A compromised Obscurus account or Cloudflare operator can join domains. The honest claim is “not shared with the merchant by default,” not “Obscurus cannot know.”

---

## ADR-0006 — PaymentProvider before any chain code

**Status:** Proposed

**Context.** Phase 1 needs payments in the domain without EVM.

**Decision.** `CreatePayment`, `VerifyPayment`, `GetPayment` on a provider interface. `MockPaymentProvider` in Phase 1. `Refund` reserved. EVM implementation appears in Phase 5 behind the same interface. No `ethers` types in `packages/core`.

**Consequences.** Checkout and adapters can be built against mocks. Switching to chain is an adapter change plus contract work, not a rewrite of entitlements.

---

## ADR-0007 — Direct on-chain settlement in the MVP

**Status:** Proposed

**Context.** Later research may batch or shield settlement so a public observer cannot trivially link payer wallet to merchant wallet. That work is not MVP.

**Decision.** MVP contract pays the merchant settlement address (minus protocol fee) in the same transaction the customer sends. Docs and checkout copy disclose the public link. See [Privacy model](../privacy/privacy-model.md#mvp-versus-later).

**Consequences.** Simple, auditable, non-custodial for customer funds at rest in Obscurus. Weaker payment privacy on-chain. We will not market this as unlinkable.

---

## ADR-0008 — Base Sepolia and native USDC when crypto starts

**Status:** Proposed

**Context.** One EVM network, one stablecoin, testnet first. Micropayments need low fees. Circle USDC on Base Sepolia is the canonical test asset (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`).

**Decision.** Phase 5 targets Base Sepolia and that USDC contract. Mainnet Base + native USDC is a later, explicit switch. No Obscurus token.

**Consequences.** Wallet and RPC UX is one chain. Multi-chain is out of MVP. If Base is rejected, replace this ADR before writing Solidity.

---

## ADR-0009 — Custom payment contract, WalletConnect for connection only

**Status:** Proposed

**Context.** Obscurus must verify amount, asset, uniqueness of `paymentRef`, and fee. WalletConnect Pay and Coinbase x402 facilitators would move verification outside the project.

**Decision.** A Foundry contract records payment reference, merchant, asset, amount, protocol fee, and emits an event. No upgradeability in v1. No owner function that sweeps customer funds. WalletConnect AppKit connects wallets on checkout. Obscurus indexes and verifies its own events.

**Consequences.** We own security review before mainnet. We do not inherit WalletConnect Pay’s settlement or KYC model. Calldata may still expose merchant address and `paymentRef` on-chain.

---

## ADR-0010 — HTTP 402 is Obscurus-native, x402-aware

**Status:** Proposed

**Context.** Coinbase x402 is the main emerging HTTP payment handshake (`PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE`, facilitator verify/settle). Locking the public API to one facilitator is a product risk.

**Decision.** MVP HTTP API returns `402` with a structured Obscurus body (`payment_required`, amount, asset, checkout URL, payment id). Keep headers and fields extensible. A later phase may add an x402 envelope. Obscurus remains the verifier.

**Consequences.** Agents may need a thin client for Obscurus before x402. We avoid CDP lock-in.

---

## ADR-0011 — Secrets only through SecretProvider

**Status:** Proposed

**Context.** Merchant API keys, bot tokens, signing keys, and webhook secrets must never reach browsers or logs.

**Decision.** SecretProvider encrypts with a key-encryption key from Cloudflare Secrets Store (production) or `.dev.vars` (local). Ciphertext and metadata live in D1. After write, APIs return redacted hints only. Checkout and dashboard never receive plaintext secrets.

**Consequences.** Rotation and KMS-backed keys are production work. Lost KEK means lost merchant secrets — document backup of the KEK as an ops concern, not as “store a copy in D1.”

---

## ADR-0012 — Parse cURL, never execute it

**Status:** Proposed

**Context.** Imported cURL is hostile. Shelling out to bash is command injection.

**Decision.** A parser produces a structured request model (method, URL, headers, body). The HTTP executor is the only runner, with SSRF controls. No `child_process`, no `sh -c`.

**Consequences.** Exotic cURL flags may not import. That is acceptable. Flagship UX stays “paste cURL,” not “paste a bash script.”

---

## ADR-0013 — Published endpoint versions are immutable

**Status:** Proposed

**Context.** Changing a URL or price under an unpaid or in-flight invocation causes disputes and surprise charges.

**Decision.** Publish writes an EndpointVersion. Invocations and entitlements pin `endpoint_version_id`. Edits create a new version.

**Consequences.** Storage grows with versions. Dashboards show version history. No silent mutation of paid configurations.

---

## ADR-0014 — No Obscurus token

**Status:** Proposed

**Context.** Blockchain is payment infrastructure for USDC, not a reason to issue a speculative asset.

**Decision.** No utility token, no staking, no points that look like securities. Protocol fee is USDC (or the supported stablecoin) via `feeBps`.

**Consequences.** Fee revenue is operational. Marketing must not imply a forthcoming token.

---

## ADR-0015 — Apache License 2.0

**Status:** Proposed

**Context.** This is a public infrastructure project. Apache-2.0 includes an express patent grant that MIT lacks.

**Decision.** When Phase 16 adds LICENSE, use Apache-2.0. Phase 0 does not add the file yet, but all contributions should assume that license.

**Consequences.** Some copyleft users may prefer AGPL. If the project needs copyleft, replace this ADR before the first public release — not after.

---

## ADR-0016 — Protocol fee is configurable, rate not chosen

**Status:** Proposed

**Context.** The contract needs a fee recipient and `feeBps`. The business rate is not an engineering guess.

**Decision.** Schema and contract support `feeBps` and a treasury address. Numeric rate remains unresolved.

**Consequences.** Tests use a non-zero example (for example 250 bps) without treating it as product policy.

---

## ADR-0017 — Merchant auth in Phase 1 is email and password

**Status:** Proposed

**Context.** Phase 1 needs merchants. OAuth adds providers and account-linking before the domain exists.

**Decision.** Email + password + server session (HTTP-only cookie or equivalent). GitHub OAuth is a later addition. Customers still need no Obscurus account to pay.

**Consequences.** Password hashing, reset, and rate limits are in scope for Phase 1. No passkeys in MVP.

---

## ADR-0018 — Testnet confirmation is inclusion

**Status:** Proposed

**Context.** Base is an L2. Waiting for many L1 confirmations on testnet slows the product without teaching a real reorg policy.

**Decision.** Testnet: treat transaction inclusion as sufficient to enter `CONFIRMING` then `PAID` after provider verify. Mainnet confirmation depth is a later ADR, required before mainnet.

**Consequences.** Testnet may reorg more than we like. Do not copy this policy blindly to mainnet.

---

## ADR-0019 — Short TTL for invocation payloads

**Status:** Proposed

**Context.** Inputs can be personal. Financial payment rows may need longer retention. These are different classes. See [Data classification](../privacy/data-classification.md).

**Decision.** Proposed default: invocation payload bodies retained 7 days, then reduced to hashes. Payment rows retained longer, with payment identity access-controlled. Exact legal retention is unresolved.

**Consequences.** Debugging after 7 days uses hashes and merchant-visible outputs only, unless a lawful longer hold is defined later.

---

## Unresolved (not silently filled)

- Exact protocol fee
- Merchant KYC, sanctions screening, geographic restrictions
- Whether payer address is deleted or hashed after confirmation
- npm scope (placeholder `@obscurus`). Source repository is `github.com/alpdogan/obscuropay`.
- Telegram paid-digital-goods policy before production Telegram
- Independent contract audit vendor (required before mainnet)
- Financial-record law vs payment row retention
- Cloudflare Workflows vs Queues for fulfillment (Queues + Durable Object alarms for MVP)
- Production KEK backup procedure

---

## Review ask

Approve, reject, or amend ADRs 0001–0019. Phase 1 should not start until 0001–0006, 0011–0013, and 0017 are accepted. Chain ADRs (0007–0009, 0018) can wait until Phase 5 but should not be contradicted by Phase 1 schema.
