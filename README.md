# Obscurus

**Prove you paid. Not who you are.**

Privacy-first payment infrastructure for APIs, bots, and autonomous software.

The merchant API, cURL importer, response mapping, and payment state machine run on Cloudflare Workers and D1. `ObscurusPay` is a Foundry contract for Base Sepolia USDC only — it is not deployed, and must not be deployed to mainnet. Hosted checkout lives at `/pay/{payment_id}` (`apps/checkout`). The merchant console is `apps/dashboard`. Customers do not need an Obscurus account. Runtime payments still use the development mock provider unless WalletConnect and the contract are configured.

**[Architecture book](docs/README.md)** · **[Merchant API](docs/protocol/merchant-api.md)**

Requires Node.js 22.

```bash
pnpm install
cp services/platform/.dev.vars.example services/platform/.dev.vars
pnpm test
pnpm dev
```
