# Obscurus

**Prove you paid. Not who you are.**

Privacy-first payment infrastructure for APIs, bots, and autonomous software.

The merchant API, cURL importer, response mapping, and payment state machine run on Cloudflare Workers and D1. Hosted checkout UI is not built yet. Payments use a development mock provider — not a chain.

**[Architecture book](docs/README.md)** · **[Merchant API](docs/protocol/merchant-api.md)**

Requires Node.js 22.

```bash
pnpm install
cp services/platform/.dev.vars.example services/platform/.dev.vars
pnpm test
pnpm dev
```
