# ObscurusPay

Foundry contract for the WalletConnect + USDC MVP. **Base Sepolia only. One USDC. Do not deploy to mainnet.**

Circle USDC on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (chain id `84532`).

## What it stores

`pay(bytes32 paymentRef, address merchant, address asset, uint256 amount)` pulls the configured USDC, sends `amount - fee` to the merchant and `fee` to the treasury, and emits `PaymentReceived`.

On-chain fields are settlement only: opaque `paymentRef`, merchant address, asset, amount, fee. Never Telegram IDs, emails, names, query text, or merchant API URLs.

## What it refuses

- Upgrade proxies (no UUPS, no transparent proxy)
- Owner sweep / rescue of tokens (including USDC sent to the contract by mistake)
- Any chain other than Base Sepolia or Anvil (`31337` for tests)
- A second `pay` with the same `paymentRef`
- A token other than the constructor USDC
- `feeBps` above 10% (`MAX_FEE_BPS = 1000`). The business rate is still unresolved; tests use 100 bps as a placeholder

## Commands

Requires [Foundry](https://book.getfoundry.sh/getting-started/installation).

```bash
pnpm --filter @obscurus/contracts test
pnpm --filter @obscurus/contracts typecheck
```

A Base Sepolia deploy script exists at `script/DeployBaseSepolia.s.sol`. It reverts on any other `chainid`. Do not broadcast it as part of this repository’s default workflow.

Verification of `paymentRef`, amount, and asset still happens in the Worker (`PaymentProvider`). This contract is the on-chain adapter, not a source of customer identity.
