# Obscurus

**Prove you paid. Not who you are.**

Privacy-first payment infrastructure for APIs, bots, and autonomous software.

Paste an existing HTTP API, set a price, and publish it through Telegram, MCP, HTTP 402, or hosted checkout. The merchant learns that payment succeeded. The merchant does not learn who paid, unless an endpoint asks and checkout discloses that field.

This is data minimization. It is not untraceable money. MVP settlement is USDC on a public EVM testnet.

## Status

Apache-2.0. Phases 0–16 are implemented. `ObscurusPay` is **not deployed** and must not be deployed to mainnet. Runtime payments still use the development mock provider unless WalletConnect and the contract are configured.

## Layout

| Path | Role |
| ---- | ---- |
| `packages/core` | Domain rules. No `cloudflare` imports. |
| `services/platform` | Hono Worker, D1, adapters |
| `apps/dashboard` | Merchant console |
| `apps/checkout` | Hosted `/pay/{id}` |
| `apps/website` | Public site and `/privacy` |
| `contracts` | Foundry `ObscurusPay` |

## Develop

Requires Node.js 22.

```bash
pnpm install
cp services/platform/.dev.vars.example services/platform/.dev.vars
pnpm test
pnpm typecheck
pnpm dev
```

Optional: `pnpm dev:dashboard`, `pnpm dev:checkout`, `pnpm dev:website`.

Do not commit `.dev.vars` or other secrets.

## Docs

**[Architecture book](docs/README.md)** · **[Merchant API](docs/protocol/merchant-api.md)** · **[Privacy](apps/website/app/privacy/page.tsx)** · **[Security](SECURITY.md)** · **[Contributing](CONTRIBUTING.md)** · **[Code of conduct](CODE_OF_CONDUCT.md)** · **[Changelog](CHANGELOG.md)**

## License

Copyright 2026 Obscurus contributors. Licensed under the [Apache License 2.0](LICENSE).
