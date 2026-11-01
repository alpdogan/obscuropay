# Testing Guide

Obscurus is designed to be testable end-to-end without blockchain deployment or testnet funds. The `MockPaymentProvider` enables full payment flow testing in local development.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test

# Run specific test suite
pnpm --filter @obscurus/core test
pnpm --filter @obscurus/platform test

# Start development server with mock provider
pnpm dev
```

The platform automatically uses `MockPaymentProvider` when `PAY_CONTRACT` is not configured in `.dev.vars`.

## Test Architecture

### Test Layers

1. **Core Domain Tests** (`packages/core/tests/`)
   - Pure business logic
   - Payment state machine
   - Pricing models
   - Entitlements
   - No infrastructure dependencies

2. **Platform Integration Tests** (`services/platform/tests/`)
   - Full HTTP API tests
   - Database interactions
   - Authentication flows
   - All integrations (Telegram, MCP, HTTP 402)
   - Uses Cloudflare's `@cloudflare/vitest-pool-workers`

3. **Contract Tests** (`contracts/test/`)
   - Solidity unit tests with Foundry
   - ObscurusPay contract behavior
   - ERC-20 interactions

## MockPaymentProvider

The mock provider implements the `PaymentProvider` interface for testing without blockchain:

```typescript
import { MockPaymentProvider } from "@obscurus/core";

const provider = new MockPaymentProvider();

// Create a payment
const payment = await provider.createPayment({
  merchantId: "merch_1",
  endpointId: "ept_1",
  invocationId: "inv_1",
  amount: "0.50",
  asset: "USDC",
});

// Mark as paid (test helper)
provider.markComplete(payment.id);

// Verify payment
const result = await provider.verifyPayment(payment.id);
// => { matched: true, state: "PAID" }
```

### Key Features

- **In-memory storage** - No database required
- **Instant verification** - No blockchain polling
- **Idempotent operations** - Same guarantees as real provider
- **Test helpers** - `markComplete()` to simulate payment
- **Development-only** - Never used in production

## Test Coverage

### Merchant API (`services/platform/tests/api.test.ts`)

✅ Registration and authentication
✅ Project creation
✅ Secret storage (encrypted, redacted)
✅ Endpoint CRUD operations
✅ cURL import without secret leaks
✅ Tenant isolation
✅ SSRF protection

### Payment Flow

✅ Payment creation (AWAITING_PAYMENT)
✅ Mock completion
✅ Verification (PAID)
✅ Fulfillment (FULFILLED)
✅ Idempotent operations
✅ State transitions
✅ Expiry handling
✅ No wallet leakage in responses

### Integrations

**Telegram**
✅ Bot token storage (redacted)
✅ Webhook authentication
✅ Payment-required response
✅ Chat resumption after payment
✅ No chat ID leakage

**MCP**
✅ Tool listing
✅ Silent spend prevention
✅ Payment-required errors
✅ Authorized execution

**HTTP 402**
✅ Native payment_required response
✅ Structured error format
✅ Payment ID in response
✅ Retry with payment_id

**Webhooks**
✅ Signature generation
✅ Secret redaction
✅ Event delivery
✅ Retry mechanism
✅ No wallet data in payloads

### Branding

✅ Display name update
✅ Logo upload (R2)
✅ XSS protection
✅ Content-Type validation

## Running Tests Locally

### Core Tests

```bash
cd packages/core
pnpm test

# Watch mode
pnpm test --watch

# Coverage
pnpm test --coverage
```

### Platform Tests

```bash
cd services/platform
pnpm test

# Single test file
pnpm test api.test.ts
```

### Contract Tests

```bash
cd contracts
forge test

# Verbose output
forge test -vvv

# Gas report
forge test --gas-report
```

## Writing New Tests

### Core Domain Test

```typescript
import { describe, expect, it } from "vitest";
import { MockPaymentProvider } from "../src/payment/mock.ts";

describe("feature", () => {
  it("should do something", async () => {
    const provider = new MockPaymentProvider();
    const payment = await provider.createPayment({
      merchantId: "m1",
      endpointId: "e1",
      invocationId: "i1",
      amount: "1.00",
      asset: "USDC",
    });
    
    expect(payment.state).toBe("AWAITING_PAYMENT");
  });
});
```

### Platform Integration Test

```typescript
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("api endpoint", () => {
  it("should return data", async () => {
    const response = await SELF.fetch("https://obscurus.test/v1/endpoint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: "value" }),
    });
    
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ expected: "shape" });
  });
});
```

## Demo Flow

See [Demo Flow Documentation](./demo-flow.md) for step-by-step examples of:

- Creating a merchant account
- Setting up an endpoint
- Testing payment flow with mock provider
- Verifying fulfillment

## Mock vs Real Provider

| Feature | MockPaymentProvider | ChainPaymentProvider |
|---------|-------------------|---------------------|
| Setup | None | Requires PAY_CONTRACT, RPC, etc |
| Speed | Instant | ~3-5 seconds per verification |
| Cost | Free | Requires testnet USDC |
| State | In-memory | On-chain + database |
| Verification | Manual (`markComplete`) | Blockchain event indexing |
| Production | ❌ Never | ✅ Required |

## Continuous Integration

Tests run on every push:

```yaml
# .github/workflows/test.yml (example)
- run: pnpm install
- run: pnpm test
- run: pnpm typecheck
```

All tests must pass before merge.

## Further Reading

- [Mock Provider Details](./mock-provider.md)
- [Demo Flow Examples](./demo-flow.md)
- [Architecture Overview](../architecture/overview.md)
- [Payment Flow](../protocol/payment-flow.md)
