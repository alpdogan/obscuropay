# Contributing

Obscurus is a TypeScript monorepo. Domain logic lives in `packages/core` and must not import `cloudflare:workers`.

## Requirements

- Node.js 22
- pnpm 12
- Foundry on `PATH` for `packages`/`contracts` tests (`~/.foundry/bin`)

```bash
pnpm install
cp services/platform/.dev.vars.example services/platform/.dev.vars
pnpm test
pnpm typecheck
```

## Rules

- Conventional commits (`feat:`, `fix:`, `docs:`).
- One focused change per pull request.
- Do not add wallet balances, fiat on-ramps, Apple/Google Pay, custom ZK, or Discord/Slack adapters without a new ADR. Those are post-MVP (phase 17+).
- Merchant-facing JSON and webhooks must not include a customer wallet by default.
- Do not commit secrets.

## Style

Match the surrounding TypeScript. Prefer small ports in `packages/core` and adapters in `services/platform`.
