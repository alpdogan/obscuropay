# Threat model

Phase 0 analysis. Each row is an expected attacker, not a hypothetical for a later paper. Controls named here are design obligations for later phases.

Scope: WalletConnect + USDC MVP on Cloudflare Workers, D1, KV, Durable Objects, Queues, R2. Out of scope as mitigations we do not yet have: shielded pools, unlinkable credentials, Obscurus Wallet.

## Method

For each threat: actor, attack, impact, Phase 0 control (design), later control.

STRIDE-style categories appear in **Type**.

## Threats

### T1 — Malicious merchant — SSRF

**Type:** Spoofing / elevation against Obscurus and other tenants.

**Attack.** Endpoint URL or redirect points at `127.0.0.1`, cloud metadata, D1/admin, or another merchant’s internal host. cURL paste includes that URL.

**Impact.** Worker becomes a proxy. Secrets or cloud credentials may leak. Other services may be probed.

**Phase 0 control.** HTTP executor SSRF policy in [security model](security-model.md). Parse, do not shell. DNS + IP validation, redirect re-validation, scheme and method allowlists.

**Later.** Continuous blocklist updates, egress metrics, abuse reports in admin.

### T2 — Malicious merchant — secret exfiltration via headers or URL

**Attack.** Template injects Obscurus env secrets, or logs merchant-supplied headers that include stolen customer data sent back to the merchant.

**Impact.** Platform secret leak, or customer data the merchant should not have received from *Obscurus* (the merchant already sees inputs they required).

**Phase 0 control.** Templates may only interpolate InputSchema fields and documented fulfillment fields. Env and SecretProvider keys are not in the template language. Executor does not attach Obscurus platform credentials to merchant calls.

**Later.** Template linting in the dashboard.

### T3 — Malicious merchant — over-collection

**Attack.** Endpoint requires email, wallet, or Telegram id “because we want it.”

**Impact.** Breaks the product promise if Obscurus silently forwards identity.

**Phase 0 control.** Identity attributes are opt-in per endpoint, disclosed on checkout (“What is shared?”). Default payload is fulfillment data only.

**Later.** Privacy center and review of advertised claims.

### T4 — Malicious customer — unpaid fulfillment

**Attack.** Call invoke, skip payment, replay an old payment id, or send `paid=true`.

**Impact.** Theft of merchant API output.

**Phase 0 control.** Entitlement gate. Client flags ignored. Unique `paymentRef`. Durable Object single claim.

**Later.** Anomaly limits per service identity.

### T5 — Malicious customer — payload injection

**Attack.** Input contains SSRF URLs, giant JSON, or template escapes intended to break response mapping or Telegram HTML.

**Impact.** Executor abuse, adapter XSS, cost amplification.

**Phase 0 control.** Typed InputSchema, size limits, output encoding per channel (Telegram text vs HTTP JSON). Merchant API response treated as untrusted.

**Later.** Per-endpoint payload budgets.

### T6 — Stolen merchant credentials

**Attack.** Phished dashboard session. Attacker rotates bot tokens, changes settlement address, dumps invocations.

**Impact.** Fraudulent settlement, Telegram takeover, data from retained payloads.

**Phase 0 control.** HTTP-only sessions, password hashing, rate limits. Settlement address changes emit AuditEvents and should require re-auth (Phase 1+). Payload TTL (ADR-0019).

**Later.** 2FA, SSO, settlement change delays.

### T7 — Stolen Obscurus credentials

**Attack.** Wrangler token, Cloudflare account, or production KEK.

**Impact.** Full correlation of service and payment identity, secret ciphertext theft, fraudulent entitlements.

**Phase 0 control.** Name this honestly: merchant privacy does not bind a platform attacker. Secrets Store, role separation, no secrets in git. AuditEvents for admin.

**Later.** Hardware-backed keys, break-glass procedures, external SOC.

### T8 — Webhook forgery

**Attack.** Attacker POSTs `payment.confirmed` to the merchant.

**Impact.** Merchant fulfills outside Obscurus or books revenue that did not happen — if they trust the webhook blindly. Obscurus itself must not fulfill from a forged inbound webhook.

**Phase 0 control.** Outbound webhooks signed. Obscurus does not accept merchant or customer webhooks as payment proof. Merchants get verification examples.

**Later.** Dashboard “retry” and signature test vectors.

### T9 — Replay of signed webhooks or checkout URLs

**Attack.** Reuse of `X-Obscurus-Signature` or of a checkout session.

**Impact.** Duplicate merchant-side processing, or paying the wrong invocation if ids are confused.

**Phase 0 control.** Timestamp window, idempotency keys, payment and invocation ids in the body, single-use entitlements.

**Later.** Configurable webhook tolerance with a documented maximum.

### T10 — Payment replay / duplicate fulfillment

**Attack.** Same on-chain transaction presented twice, or two workers handle the same event.

**Impact.** Two merchant API calls for one payment, or two merchants credited.

**Phase 0 control.** Unique `paymentRef` on-chain and in D1. Queue + Durable Object serialization. Entitlement uniqueness constraint.

**Later.** Explicit chain reorg handling on mainnet (ADR-0018).

### T11 — Double spend on-chain

**Attack.** Classic ERC-20 races, fee-on-transfer tokens, or paying a different contract.

**Impact.** `PAID` without merchant receiving `amount`.

**Phase 0 control.** MVP asset is USDC-style on a known contract. Verify amount received (balance delta or Transfer logs), not only `msg.value` analog. Reject unexpected tokens.

**Later.** Token allowlist governance.

### T12 — DNS rebinding

**Attack.** Hostname resolves public, then private, between check and connect.

**Impact.** SSRF bypass.

**Phase 0 control.** Resolve, pin IPs, connect only to those IPs if the runtime allows, re-validate redirects. Reject hosts that resolve mixed forbidden addresses.

**Later.** Egress proxy with pinning if Workers cannot pin connections.

### T13 — Malicious cURL input

**Attack.** `curl ... | sh` in the paste, backticks, process substitution, file writes.

**Impact.** RCE if executed.

**Phase 0 control.** Parser only. No shell. Unknown flags dropped or rejected.

**Later.** Fuzz the parser.

### T14 — Secret leakage in logs and traces

**Attack.** `console.log(request.headers)`, Cloudflare trace of body, error messages that echo Authorization.

**Impact.** Secret in observability products, then in support tickets.

**Phase 0 control.** Redaction policy. Default fields listed in [data classification](../privacy/data-classification.md). Never log secrets.

**Later.** Phase 14 structured redaction implementation and tests.

### T15 — Payment spoofing in the UI

**Attack.** Modified checkout JavaScript reports success; Telegram deep link includes `paid=1`.

**Impact.** None if the gate is correct; theft if any path trusts the client.

**Phase 0 control.** No fulfillment path reads client payment flags. Checkout polls Obscurus status.

**Later.** Integrity of checkout bundles (lockfile, CI).

### T16 — Compromised async consumer

**Attack.** Malicious deploy or dependency in queue handler.

**Impact.** Unauthorized entitlements, exfil of D1, SSRF at scale.

**Phase 0 control.** Same Worker as fetch — blast radius is the platform. Code review, lockfiles, least-privilege bindings (no Cloudflare API token in Env). Idempotent writes so a replaying attacker still cannot double-fulfill without also breaking uniqueness — they can still create bogus payments if they can call domain APIs internally.

**Later.** Split workers with tighter bindings; deploy approvals.

### T17 — Compromised D1

**Attack.** Snapshot leak, SQL injection, stolen dashboard of Cloudflare.

**Impact.** Metadata, ciphertext, correlation ids, hashed service identities. Plaintext secrets only if KEK also leaks or encryption is wrong.

**Phase 0 control.** Parameterized SQL only. KEK not in D1. Hash service identities. Minimize payload retention.

**Later.** Envelope encryption review, backups with the same classification.

### T18 — Correlation attacks

**Attack.** Merchant matches timestamps, amounts, and chain transfers; Telegram bot plus public tx; MCP operator sees both wallet and tool call.

**Impact.** Re-link payment identity to a person despite merchant API redaction.

**Phase 0 control.** Honest disclosure: MVP does not prevent a motivated observer with chain access plus side channels. Timing jitter is not a privacy protocol. Checkout explains blockchain visibility.

**Later.** Phase 24–25 research. Do not ship fake jitter as “anonymity.”

### T19 — Malicious merchant API response

**Attack.** 30 GB body, redirect to metadata, `text/html` with script if dashboard previews it, header bombs.

**Impact.** Isolate memory exhaustion (128 MB class), XSS in merchant tools, SSRF via Location.

**Phase 0 control.** Stream with byte cap. Redirect policy. Preview as text/JSON escaped, never `innerHTML`. Telegram adapter uses safe parse modes.

**Later.** Response schema validation optional per endpoint.

### T20 — Dependency compromise

**Attack.** npm package in checkout or Worker steals secrets or payment data.

**Impact.** Wide.

**Phase 0 control.** Lockfiles, minimize dependencies in `packages/core` and checkout. Prefer well-known WalletConnect and Cloudflare libraries.

**Later.** Automated audit in CI, pinned hashes where feasible.

### T21 — Frontend supply chain

**Attack.** Compromised WalletConnect script or Next.js dependency on checkout.

**Impact.** Wallet drain, phishing inside a trusted origin.

**Phase 0 control.** Treat checkout as high-sensitivity. Subresource policy, no merchant JS. Disclose WalletConnect as TCB.

**Later.** SRI where applicable, monitored releases.

### T22 — Stolen Telegram bot token

**Attack.** Token in git, logs, or dashboard copy-paste.

**Impact.** Attacker impersonates the bot, receives user messages (service identity and inputs).

**Phase 0 control.** SecretProvider, redaction, token shown once. Rotate on leak. Telegram adapter verifies webhook secret.

**Later.** Automatic token-in-git scanning.

### T23 — MCP client overspend

**Attack.** Agent loops a paid tool.

**Impact.** Customer wallet drains.

**Phase 0 control.** Every call still needs entitlement and explicit payment UX in MVP (no silent WalletConnect in a loop). Spending policy (`max_per_call`, `max_per_day`) is designed, not implemented. Do not silently spend.

**Later.** Phase 11+ policy engine.

### T24 — Cross-tenant data in D1

**Attack.** Missing `merchant_id` predicate.

**Impact.** Direct privacy and security failure.

**Phase 0 control.** Every repository method requires tenant id. Tests for negative authorization.

**Later.** Query lint in review.

## Out of scope (named)

- Nation-state compromise of Cloudflare’s entire fleet
- Physical theft of a customer’s phone after WalletConnect is unlocked
- Bugs in USDC itself
- Telegram the company reading bot traffic
- Public EVM observers (not a bug; a property of the MVP chain)

## Residual risk the product will publish

The WalletConnect MVP cannot stop a public observer from linking payer wallet, amount, and merchant settlement address. Obscurus will say this on checkout and in the privacy center. Hiding it would be a vulnerability in the threat model of the *user’s trust*, which is in scope.
