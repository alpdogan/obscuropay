# Obscurus

**Prove you paid. Not who you are.**

Privacy-first payment infrastructure for APIs, bots, and autonomous software.

Paste an existing HTTP API, set a price, and publish it through Telegram, MCP, HTTP 402, or hosted checkout. The merchant learns that payment succeeded. The merchant does not learn who paid, unless an endpoint asks and checkout discloses that field.

This is data minimization. It is not untraceable money. MVP settlement is USDC on a public EVM testnet.

## Status

Apache-2.0. Phases 0–16 are implemented. `ObscurusPay` is **not deployed** by this repository and must not be deployed to mainnet. Set `PAY_CONTRACT` and a WalletConnect project id to verify Base Sepolia USDC. Otherwise local development uses the mock provider, which production refuses.

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

### End-to-End Tests

Run E2E tests with Playwright:

```bash
# Run all E2E tests (starts servers automatically)
pnpm test:e2e

# Run with UI mode
pnpm test:e2e:ui

# Run in headed mode (see browser)
pnpm test:e2e:headed

# View test report
pnpm test:e2e:report
```

E2E tests include video recordings saved to `test-results/` directory.

Do not commit `.dev.vars` or other secrets.

## Testing

**[Testing Guide](docs/testing/README.md)** · **[Mock Provider](docs/testing/mock-provider.md)** · **[Demo Flow](docs/testing/demo-flow.md)**

The platform uses `MockPaymentProvider` for local development and testing without blockchain setup. See the testing guide for end-to-end examples.

## Docs

**[Architecture book](docs/README.md)** · **[Merchant API](docs/protocol/merchant-api.md)** · **[Chain & Token Support](docs/protocol/chain-token-support.md)** · **[Privacy](apps/website/app/privacy/page.tsx)** · **[Security](SECURITY.md)** · **[Contributing](CONTRIBUTING.md)** · **[Code of conduct](CODE_OF_CONDUCT.md)** · **[Changelog](CHANGELOG.md)**

## License

Copyright 2026 Obscurus contributors. Licensed under the [Apache License 2.0](LICENSE).
