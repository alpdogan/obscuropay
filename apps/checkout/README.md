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

WalletConnect AppKit lives in `app/pay/[paymentId]/wallet-kit.ts`. Reown’s wagmi adapter currently pulls Coinbase x402 optional modules that Next cannot resolve, so the pay page does not import that file at build time. On-chain pay is the same `approve` + `ObscurusPay.pay` flow once a contract and project id are configured.

On-chain pay targets Base Sepolia USDC and `ObscurusPay`. The merchant must set `settlement_address` via `PATCH /v1/auth/me`. Merchants still do not receive the customer wallet from Obscurus.

The **What is shared?** inspector on the pay page is the customer-facing privacy disclosure. It separates merchant fulfillment data from on-chain visibility and refuses untraceable-money language.
