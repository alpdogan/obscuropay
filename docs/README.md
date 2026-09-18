# Obscurus architecture book

**Prove you paid. Not who you are.**

Obscurus is privacy-first payment infrastructure for APIs, bots, and autonomous software. A merchant pastes an existing HTTP API, sets a price, and publishes it through Telegram, MCP, HTTP 402, or hosted checkout. Obscurus sits between the customer and the merchant API. The merchant learns that payment succeeded. The merchant does not learn who paid, unless an endpoint explicitly asks and discloses that requirement.

This directory is the public architecture book. It is the source of truth for what Obscurus is, what it stores, what it claims, and what it refuses to claim. Implementation follows these documents. Marketing follows these documents. If a sentence here and a sentence in the product UI disagree, this book wins.

Phase 0 is documentation only. There is no application code yet.

## Start here

1. [Glossary](architecture/glossary.md) — terms used everywhere else
2. [Architecture overview](architecture/overview.md) — components, hosting, domain
3. [Data flow](architecture/data-flow.md) — how a request becomes a paid invocation
4. [Trust boundaries](architecture/trust-boundaries.md) — who is trusted for what
5. [Architectural decisions](architecture/decisions.md) — ADRs awaiting review

Then read protocol, privacy, and security:

- [Invocation flow](protocol/invocation-flow.md)
- [Payment flow](protocol/payment-flow.md)
- [Privacy model](privacy/privacy-model.md)
- [Data classification](privacy/data-classification.md)
- [Security model](security/security-model.md)
- [Threat model](security/threat-model.md)

## What this product is

Obscurus Pay turns an existing API into a paid service without asking the merchant to write blockchain, WalletConnect, or Telegram payment code.

The merchant experience is:

**Paste API → Define inputs → Set price → Choose channel → Publish.**

The customer promise is:

**Your payment identity is not shared with the merchant by default.**

That promise is about data minimization between Obscurus and the merchant. It is not a claim of blockchain anonymity. The WalletConnect + USDC MVP settles on a public EVM chain. A public observer can still see a payer wallet send USDC to a merchant settlement address. See [Privacy model](privacy/privacy-model.md).

## Hosting

Obscurus runs on **Cloudflare Workers** with **D1** as the system of record.

The original language sketch used Go and PostgreSQL. Workers is a V8 isolate platform. TypeScript is native there. Go is not a first-class Workers runtime for this product. The backend is therefore **TypeScript** on Workers, with `nodejs_compat` where libraries need Node built-ins. Smart contracts remain Solidity and are not hosted on Cloudflare.

Local development uses Wrangler and Miniflare. Production does not require Kubernetes, Docker, PostgreSQL, or Redis.

## How to read claims

Every privacy and security claim in this book is scoped to an implementation phase.

- **MVP** means WalletConnect checkout, one EVM testnet, one USDC-style ERC-20, hosted checkout, Telegram, MCP, and HTTP 402. Identity separation is real. On-chain unlinkability is not.
- **Later** means Obscurus Wallet, balances, fiat funding, and researched privacy-preserving settlement. Those phases are out of scope until the MVP works and is explicitly approved.

Do not describe Obscurus as untraceable money, sanctions avoidance, tax avoidance, or anonymous illegal payments. Do not claim cryptographic anonymity unless a later protocol actually provides it.

## Status

| Document | Status |
| -------- | ------ |
| Architecture, protocol, privacy, security | Phase 0 — proposed, awaiting review |
| Application, contracts, UI | Not started |
| Phase 1 (auth, merchants, endpoints, mock payments) | Blocked on Phase 0 approval |

Unresolved decisions are listed at the end of [Architectural decisions](architecture/decisions.md).
