# Obscurus Checkout

Hosted payment page at `/pay/{payment_id}`. Customers do not create an Obscurus account. There is no Obscurus wallet, Apple Pay, or card form.

WalletConnect **AppKit** connects a wallet. Obscurus is the processor. Not WalletConnect Pay.

## Development

```bash
cp apps/checkout/.env.example apps/checkout/.env.local
pnpm --filter @obscurus/platform dev
pnpm --filter @obscurus/checkout dev
```

Without `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and `NEXT_PUBLIC_PAY_CONTRACT`, the page uses the platform’s development `mock-complete` path so the state machine can be exercised locally. That button is not a production payment method.

When `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and `NEXT_PUBLIC_PAY_CONTRACT` are set, the pay page connects with WalletConnect AppKit and sends `approve` plus `ObscurusPay.pay`. Optional Coinbase x402 modules pulled in by the wagmi adapter are aliased out of the build. Obscurus does not use an x402 facilitator. After the transaction, the page retries `POST /v1/pay/:id/verify` until the Worker sees the log.

On-chain pay targets Base Sepolia USDC and `ObscurusPay`. The merchant must set `settlement_address` via `PATCH /v1/auth/me`. Merchants still do not receive the customer wallet from Obscurus.

The **What is shared?** inspector on the pay page is the customer-facing privacy disclosure. It separates merchant fulfillment data from on-chain visibility and refuses untraceable-money language.
