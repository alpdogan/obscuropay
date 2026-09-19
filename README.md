# Obscurus

**Prove you paid. Not who you are.**

Privacy-first payment infrastructure for APIs, bots, and autonomous software.

Phase 1 implements the merchant API on Cloudflare Workers and D1. There is no customer checkout yet.

**[Architecture book](docs/README.md)** · **[Merchant API](docs/protocol/merchant-api.md)**

Requires Node.js 22.

```bash
pnpm install
cp services/platform/.dev.vars.example services/platform/.dev.vars
pnpm test
pnpm dev
```
