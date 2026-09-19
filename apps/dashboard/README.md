# Obscurus merchant dashboard

Next.js console for merchants. Customers do not have accounts here. Customer wallets are never listed.

Pages: Overview, Endpoints (cURL wizard), Integrations, Payments, Invocations, Webhooks, Branding, Developers, Settings.

```bash
cp apps/dashboard/.env.example apps/dashboard/.env.local
pnpm --filter @obscurus/platform dev
pnpm --filter @obscurus/dashboard dev
```

The dashboard talks to `/v1` on the platform Worker using the merchant session cookie. Checkout links open `/pay/{payment_id}` on the checkout app.
