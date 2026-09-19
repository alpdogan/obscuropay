# Security

## Reporting

Please report vulnerabilities privately to the repository owner. Do not open a public issue that includes secrets, customer wallets, bot tokens, or exploit payloads against third-party systems.

## What this project will not do

- Treat `paid=true` from a browser, Telegram, or MCP client as payment truth.
- Log secrets, bot tokens, webhook HMAC keys, or `SECRET_KEK`.
- Show a customer wallet in merchant APIs, dashboards, or webhooks by default.
- Deploy `ObscurusPay` to Ethereum mainnet or any chain other than Base Sepolia / Foundry local (`84532` / `31337`).

## Local secrets

Copy `services/platform/.dev.vars.example` to `.dev.vars`. Never commit `.dev.vars`, `.env`, or production KEKs.

## Verification

```bash
pnpm test
pnpm typecheck
```
