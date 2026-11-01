# End-to-End Demo Flow

This guide demonstrates a complete payment flow using the mock provider. All commands use `curl` and can be run locally without blockchain setup.

## Prerequisites

```bash
# Start the platform
pnpm dev

# Platform runs at http://localhost:8787
# (Or wherever your wrangler dev binds)
```

The platform automatically uses `MockPaymentProvider` when `PAY_CONTRACT` is not set.

## Flow Overview

```
1. Register Merchant
2. Create Project
3. Create Endpoint
4. Customer Invokes Endpoint
5. Payment Required (402)
6. Mock Payment Completion
7. Verify Payment
8. Fulfill Request
9. View Results
```

---

## Step 1: Register Merchant

```bash
curl -X POST http://localhost:8787/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@example.com",
    "password": "secure-password-123"
  }' \
  -c cookies.txt \
  -w "\n"
```

**Response (201):**
```json
{
  "merchant": {
    "id": "merch_...",
    "email": "merchant@example.com",
    "created_at": 1234567890
  }
}
```

The session cookie is saved to `cookies.txt`.

---

## Step 2: Create Project

```bash
curl -X POST http://localhost:8787/v1/projects \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "My API"
  }' \
  -w "\n"
```

**Response (201):**
```json
{
  "project": {
    "id": "proj_abc123",
    "merchant_id": "merch_...",
    "name": "My API",
    "created_at": 1234567890
  }
}
```

Save `project.id` for next steps.

---

## Step 3: Create Endpoint

```bash
PROJECT_ID="proj_abc123"  # From step 2

curl -X POST http://localhost:8787/v1/endpoints \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "project_id": "'$PROJECT_ID'",
    "name": "Search API",
    "method": "GET",
    "url": "https://httpbin.org/json",
    "input_schema": {
      "fields": []
    },
    "price_amount": "0.25",
    "price_asset": "USDC"
  }' \
  -w "\n"
```

**Response (201):**
```json
{
  "endpoint": {
    "id": "ept_xyz789",
    "project_id": "proj_abc123",
    "slug": "search_api",
    "name": "Search API",
    "method": "GET",
    "url": "https://httpbin.org/json",
    "pricing": {
      "type": "PER_REQUEST",
      "amount": "0.25",
      "asset": "USDC"
    },
    "published_at": 1234567890
  }
}
```

Save `endpoint.id`.

---

## Step 4: Invoke Endpoint (Customer)

Customer calls the endpoint without authentication:

```bash
ENDPOINT_ID="ept_xyz789"  # From step 3

curl -X POST http://localhost:8787/v1/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint_id": "'$ENDPOINT_ID'",
    "input": {}
  }' \
  -w "\n"
```

**Response (201):**
```json
{
  "payment": {
    "id": "pay_demo123",
    "state": "AWAITING_PAYMENT",
    "amount": "0.25",
    "asset": "USDC",
    "checkout_url": "/pay/pay_demo123",
    "expires_at": 1234571490
  },
  "invocation": {
    "id": "inv_demo456",
    "status": "AWAITING_PAYMENT"
  }
}
```

Save `payment.id` and `invocation.id`.

---

## Step 5: Get Payment Details

Customer (or checkout UI) fetches payment info:

```bash
PAYMENT_ID="pay_demo123"  # From step 4

curl http://localhost:8787/v1/pay/$PAYMENT_ID \
  -w "\n"
```

**Response (200):**
```json
{
  "payment": {
    "id": "pay_demo123",
    "state": "AWAITING_PAYMENT",
    "amount": "0.25",
    "asset": "USDC",
    "service_name": "Search API",
    "settlement_address": null,
    "merchant_name": "My API",
    "payment_ref": "a1b2c3...",
    "provider": "mock"
  },
  "disclosure": {
    "will_see": ["service_name", "amount"],
    "will_not_see": ["customer_wallet", "ip_address"]
  }
}
```

Notice:
- `provider: "mock"` (using mock provider)
- `settlement_address: null` (merchant hasn't set one yet)
- Privacy disclosure included

---

## Step 6: Mock Payment Completion

**Test-only endpoint** to simulate customer payment:

```bash
curl -X POST http://localhost:8787/v1/pay/$PAYMENT_ID/mock-complete \
  -w "\n"
```

**Response (200):**
```json
{
  "mock": {
    "completed": true,
    "payment_id": "pay_demo123"
  }
}
```

⚠️ **This endpoint only exists when `MockPaymentProvider` is active.** Returns 404 in production.

---

## Step 7: Verify Payment

Now anyone can verify the payment (no auth required):

```bash
curl -X POST http://localhost:8787/v1/pay/$PAYMENT_ID/verify \
  -w "\n"
```

**Response (200):**
```json
{
  "matched": true,
  "payment": {
    "id": "pay_demo123",
    "state": "PAID",
    "amount": "0.25",
    "asset": "USDC"
  }
}
```

The payment transitioned:
```
AWAITING_PAYMENT → CONFIRMING → PAID
```

Subsequent verify calls remain idempotent:

```bash
curl -X POST http://localhost:8787/v1/pay/$PAYMENT_ID/verify -w "\n"
# => { "matched": true, "payment": { "state": "PAID" } }
```

---

## Step 8: Fulfill Request

Execute the endpoint and return the result:

```bash
curl -X POST http://localhost:8787/v1/pay/$PAYMENT_ID/fulfill \
  -w "\n"
```

**Response (200):**
```json
{
  "payment": {
    "id": "pay_demo123",
    "state": "FULFILLED"
  },
  "invocation": {
    "id": "inv_demo456",
    "status": "FULFILLED",
    "http_status": 200,
    "output": {
      "result": {
        "slideshow": {
          "title": "Sample Slide Show"
        }
      }
    }
  }
}
```

The endpoint was executed:
- HTTP request sent to `https://httpbin.org/json`
- Response captured
- Result returned to customer
- State: `FULFILLED`

Subsequent fulfill calls are idempotent (same result returned).

---

## Step 9: View Payment History (Merchant)

Merchant views their payments:

```bash
curl http://localhost:8787/v1/payments \
  -b cookies.txt \
  -w "\n"
```

**Response (200):**
```json
{
  "payments": [
    {
      "id": "pay_demo123",
      "endpoint_id": "ept_xyz789",
      "endpoint_name": "Search API",
      "amount": "0.25",
      "asset": "USDC",
      "state": "FULFILLED",
      "created_at": 1234567890
    }
  ]
}
```

Notice:
- No `customer_wallet` field
- No `payer_address`
- Privacy boundaries respected

---

## Step 10: View Invocations (Merchant)

```bash
curl http://localhost:8787/v1/invocations \
  -b cookies.txt \
  -w "\n"
```

**Response (200):**
```json
{
  "invocations": [
    {
      "id": "inv_demo456",
      "endpoint_id": "ept_xyz789",
      "endpoint_name": "Search API",
      "status": "FULFILLED",
      "source": "api",
      "input": {},
      "created_at": 1234567890,
      "fulfilled_at": 1234567950
    }
  ]
}
```

---

## Alternative: HTTP 402 Flow

Instead of the manual invoke flow, use the 402 protocol:

### First Request (Unpaid)

```bash
curl -X POST http://localhost:8787/v1/invoke/search_api \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "'$PROJECT_ID'"
  }' \
  -w "\n"
```

**Response (402 Payment Required):**
```json
{
  "error": "payment_required",
  "payment": {
    "id": "pay_new123",
    "amount": "0.25",
    "asset": "USDC",
    "checkout_url": "/pay/pay_new123"
  }
}
```

### Complete Payment

```bash
PAYMENT_ID="pay_new123"
curl -X POST http://localhost:8787/v1/pay/$PAYMENT_ID/mock-complete -w "\n"
curl -X POST http://localhost:8787/v1/pay/$PAYMENT_ID/verify -w "\n"
```

### Retry with Payment ID

```bash
curl -X POST http://localhost:8787/v1/invoke/search_api \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "'$PROJECT_ID'",
    "payment_id": "'$PAYMENT_ID'"
  }' \
  -w "\n"
```

**Response (200):**
```json
{
  "result": {
    "slideshow": {
      "title": "Sample Slide Show"
    }
  }
}
```

Now the request succeeds!

---

## Complete Script

Save as `demo.sh`:

```bash
#!/bin/bash
set -e

API="http://localhost:8787"

echo "==> 1. Register"
curl -s -X POST $API/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}' \
  -c cookies.txt > /dev/null

echo "==> 2. Create Project"
PROJECT=$(curl -s -X POST $API/v1/projects \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"Demo"}' | jq -r '.project.id')

echo "    Project: $PROJECT"

echo "==> 3. Create Endpoint"
ENDPOINT=$(curl -s -X POST $API/v1/endpoints \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "project_id":"'$PROJECT'",
    "name":"API",
    "method":"GET",
    "url":"https://httpbin.org/json",
    "input_schema":{"fields":[]},
    "price_amount":"0.10",
    "price_asset":"USDC"
  }' | jq -r '.endpoint.id')

echo "    Endpoint: $ENDPOINT"

echo "==> 4. Invoke"
RESULT=$(curl -s -X POST $API/v1/invoke \
  -H "Content-Type: application/json" \
  -d '{"endpoint_id":"'$ENDPOINT'","input":{}}')

PAYMENT=$(echo $RESULT | jq -r '.payment.id')
echo "    Payment: $PAYMENT"

echo "==> 5. Mock Complete"
curl -s -X POST $API/v1/pay/$PAYMENT/mock-complete > /dev/null

echo "==> 6. Verify"
curl -s -X POST $API/v1/pay/$PAYMENT/verify | jq '.matched, .payment.state'

echo "==> 7. Fulfill"
curl -s -X POST $API/v1/pay/$PAYMENT/fulfill | jq '.invocation.status'

echo "==> Done!"
rm cookies.txt
```

Run it:

```bash
chmod +x demo.sh
./demo.sh
```

---

## Testing Telegram Integration

See full integration test in `services/platform/tests/api.test.ts`, but the flow is:

1. **Connect Telegram Bot**
   ```bash
   curl -X POST $API/v1/integrations/telegram \
     -b cookies.txt \
     -d '{
       "project_id": "'$PROJECT_ID'",
       "endpoint_id": "'$ENDPOINT_ID'",
       "mapping": "/search {{query}}",
       "bot_token": "123456:AAH..."
     }'
   ```

2. **Simulate Webhook**
   ```bash
   curl -X POST $API/v1/telegram/webhook/$INTEGRATION_ID \
     -H "X-Telegram-Bot-Api-Secret-Token: $SECRET" \
     -d '{
       "message": {
         "chat": {"id": 42},
         "text": "/search John"
       }
     }'
   ```

3. **Returns payment_required message** with checkout URL

4. **Complete payment**, then invoke fulfill

5. **Platform sends result** back to Telegram chat

---

## Testing MCP Integration

```bash
# List MCP servers
curl $API/v1/integrations/mcp -b cookies.txt

# Call MCP tool (payment required)
curl -X POST $API/v1/mcp/$PROJECT_ID \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_api",
      "arguments": {}
    }
  }'

# => Returns payment_required error with payment ID

# Complete payment, then retry with payment_id
```

---

## Key Takeaways

✅ **No blockchain required** - Mock provider enables full flow  
✅ **No wallet needed** - Customer never connects wallet in mock mode  
✅ **Instant verification** - No polling delays  
✅ **Same API contracts** - Real provider has identical interface  
✅ **Privacy preserved** - No wallet data in responses  
✅ **Multiple integrations** - API, Telegram, MCP, HTTP 402 all work

## Next Steps

- [Testing Guide](./README.md)
- [Mock Provider Details](./mock-provider.md)
- [Payment Flow Protocol](../protocol/payment-flow.md)
- [Merchant API Reference](../protocol/merchant-api.md)
