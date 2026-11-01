# MockPaymentProvider

The `MockPaymentProvider` is an in-memory implementation of the `PaymentProvider` interface for development and testing without blockchain infrastructure.

## Purpose

- **Local Development** - Run the full platform without Base Sepolia or testnet USDC
- **Fast Tests** - Instant payment verification instead of blockchain polling
- **CI/CD** - Run tests in isolated environments without network dependencies
- **Feature Development** - Build and test features before contract integration

## Architecture

### Interface Implementation

`MockPaymentProvider` implements the same `PaymentProvider` interface as the production blockchain provider:

```typescript
interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentRecord>;
  verifyPayment(paymentId: string): Promise<VerificationResult>;
  getPayment(paymentId: string): Promise<PaymentRecord | null>;
}
```

This ensures:
- Drop-in replacement for real provider
- Same type contracts
- Same error handling
- Same state transitions

### Internal State

```typescript
class MockPaymentProvider {
  private readonly payments = new Map<string, PaymentRecord>();
  private readonly completable = new Set<string>();
  
  // ... implementation
}
```

**payments** - In-memory store of all created payments  
**completable** - Set of payment IDs marked as "paid" via test helper

## Usage

### Basic Flow

```typescript
import { MockPaymentProvider } from "@obscurus/core";

const provider = new MockPaymentProvider();

// 1. Create payment
const payment = await provider.createPayment({
  merchantId: "merch_abc",
  endpointId: "ept_xyz",
  invocationId: "inv_123",
  amount: "0.50",
  asset: "USDC",
  expiresAt: Date.now() + 3600_000, // 1 hour
});

console.log(payment.state); // "AWAITING_PAYMENT"
console.log(payment.paymentRef); // 64-char hex string
console.log(payment.provider); // "mock"

// 2. Verify before completion (pending)
const pending = await provider.verifyPayment(payment.id);
console.log(pending.matched); // false
console.log(pending.state); // "AWAITING_PAYMENT"

// 3. Simulate payment (test helper)
provider.markComplete(payment.id);

// 4. Verify after completion (paid)
const verified = await provider.verifyPayment(payment.id);
console.log(verified.matched); // true
console.log(verified.state); // "PAID"

// 5. Retrieve payment
const retrieved = await provider.getPayment(payment.id);
console.log(retrieved?.state); // "PAID"
```

### State Transitions

The mock provider follows the same state machine as the real provider:

```
CREATED → AWAITING_PAYMENT → CONFIRMING → PAID → FULFILLING → FULFILLED
                     ↓              ↓                   ↓
                  EXPIRED        FAILED             FAILED
```

**Before markComplete:**
```typescript
verifyPayment(id) // => { matched: false, state: "AWAITING_PAYMENT" }
```

**After markComplete (first call):**
```typescript
verifyPayment(id) // => { matched: true, state: "PAID" }
// Transitions: AWAITING_PAYMENT → CONFIRMING → PAID
```

**After markComplete (subsequent calls):**
```typescript
verifyPayment(id) // => { matched: true, state: "PAID" }
// Idempotent - no further transitions
```

### Test Helper: markComplete

`markComplete(paymentId)` is the key testing utility:

```typescript
// Mark payment as paid
provider.markComplete(payment.id);

// Next verifyPayment will:
// 1. Transition to CONFIRMING
// 2. Transition to PAID
// 3. Return { matched: true, state: "PAID" }

// Subsequent verify calls remain PAID (idempotent)
```

This simulates a customer completing payment on-chain.

## Platform Integration

The platform service auto-selects the provider based on configuration:

```typescript
// services/platform/src/payment-service.ts (conceptual)
function createPaymentProvider(env: Env): PaymentProvider {
  if (env.PAY_CONTRACT) {
    return new ChainPaymentProvider({
      contractAddress: env.PAY_CONTRACT,
      rpcUrl: env.CHAIN_RPC_URL,
      // ...
    });
  }
  return new MockPaymentProvider();
}
```

**Local development** (no `PAY_CONTRACT` in `.dev.vars`):
→ MockPaymentProvider

**Production** (`PAY_CONTRACT` configured):
→ ChainPaymentProvider

## Testing Patterns

### Unit Test

```typescript
import { describe, expect, it } from "vitest";
import { MockPaymentProvider } from "@obscurus/core";

describe("payment verification", () => {
  it("returns paid after markComplete", async () => {
    const provider = new MockPaymentProvider();
    const payment = await provider.createPayment({
      merchantId: "m1",
      endpointId: "e1",
      invocationId: "i1",
      amount: "1.00",
      asset: "USDC",
    });

    provider.markComplete(payment.id);
    
    const result = await provider.verifyPayment(payment.id);
    expect(result.matched).toBe(true);
    expect(result.state).toBe("PAID");
  });
});
```

### Integration Test

```typescript
import { SELF } from "cloudflare:test";

it("completes payment flow", async () => {
  // 1. Create payment
  const res = await SELF.fetch("https://obscurus.test/v1/invoke", {
    method: "POST",
    body: JSON.stringify({ endpoint_id: "ept_1", input: {} }),
  });
  const { payment } = await res.json();

  // 2. Mock completion (test-only endpoint)
  await SELF.fetch(`https://obscurus.test/v1/pay/${payment.id}/mock-complete`, {
    method: "POST",
  });

  // 3. Verify
  const verify = await SELF.fetch(`https://obscurus.test/v1/pay/${payment.id}/verify`, {
    method: "POST",
  });
  const { matched, payment: updated } = await verify.json();
  
  expect(matched).toBe(true);
  expect(updated.state).toBe("PAID");
});
```

### Mock Completion Endpoint

The platform exposes a **development-only** endpoint for tests:

```
POST /v1/pay/:paymentId/mock-complete
```

This internally calls:
```typescript
mockProvider.markComplete(paymentId);
```

⚠️ **Production Safety**: This endpoint checks `env.PAY_CONTRACT`:
- If `PAY_CONTRACT` is set → 404 (endpoint disabled)
- If `PAY_CONTRACT` is unset → marks payment complete

This ensures the mock helper never works in production.

## Comparison with ChainPaymentProvider

| Aspect | MockPaymentProvider | ChainPaymentProvider |
|--------|-------------------|---------------------|
| **Storage** | In-memory Map | On-chain events + D1 |
| **Payment Ref** | Random 64-char hex | Real payment reference |
| **Verification** | Instant (manual flag) | Blockchain polling |
| **Latency** | 0ms | 3-5 seconds |
| **Dependencies** | None | RPC, contract, USDC |
| **Cost** | Free | Testnet/mainnet gas |
| **State Persistence** | Lost on restart | Permanent on-chain |
| **Production** | Never | Always |
| **Test Helper** | `markComplete(id)` | None (real tx required) |

## Limitations

### Not Implemented

**Refunds**: Calling `refundPayment()` throws "not implemented" on both providers in MVP.

```typescript
refundPayment(payment: PaymentRecord): PaymentRecord {
  throw new DomainError("Refunds not implemented", "not_implemented");
}
```

### No Real Payment Data

- No blockchain transaction hash
- No on-chain timestamp
- No real wallet addresses
- No gas costs

These fields are populated only by `ChainPaymentProvider`.

### Memory Only

State is lost when the process restarts. For persistent testing, use the integration test suite with D1.

## Production Detection

The mock provider self-identifies:

```typescript
readonly name = "mock";
```

Any payment created with `provider: "mock"` must never reach production fulfillment. The platform validates this before executing customer requests.

## Security

### No Secret Bypass

`MockPaymentProvider` still requires:
- Valid merchant authentication for API calls
- Payment ID verification before fulfillment
- State machine validation

The only shortcut is **blockchain verification**, not authorization.

### Test-Only Endpoints

```
POST /v1/pay/:id/mock-complete
```

This endpoint:
1. Checks if mock provider is active
2. Returns 404 if real provider is configured
3. Marks the payment complete in mock storage

Never deployed to production Workers (environment check).

## When to Use

✅ **Use MockPaymentProvider when:**
- Writing unit tests
- Developing new features locally
- Running CI/CD pipelines
- Testing without testnet funds
- Iterating on payment logic

❌ **Don't use MockPaymentProvider when:**
- Deploying to production
- Testing blockchain interactions
- Verifying contract behavior
- Validating RPC integration
- Auditing financial flows

## Related

- [Testing Guide](./README.md)
- [Demo Flow](./demo-flow.md)
- [Payment Flow Protocol](../protocol/payment-flow.md)
- [Payment Provider Interface](../../packages/core/src/payment/provider.ts)
