# Webhooks (Phase 13)

Merchants may subscribe to fulfillment events. Obscurus signs every delivery. A browser `paid=true` is never a substitute.

## Events

`payment.created` · `payment.confirmed` · `invocation.started` · `invocation.completed` · `invocation.failed`

## Payload

```json
{
  "id": "whd_…",
  "event": "payment.confirmed",
  "payment_id": "pay_…",
  "endpoint": "person_search",
  "amount": "0.50",
  "asset": "USDC"
}
```

Wallet identity is omitted by default.

## Signature

```
X-Obscurus-Timestamp: 1710000000
X-Obscurus-Signature: sha256=<hex>
```

HMAC-SHA256 of `` `${timestamp}.${rawBody}` `` with the webhook secret. Reject timestamps older than 5 minutes. The secret is returned once on create; later APIs show a hint.

## Delivery

Immediate first attempt, then backoff (1m, 5m, 15m, 1h). Dead after five failures. `POST /v1/webhooks/deliveries/:id/retry` from the dashboard. Delivery logs include status and the redacted payload, not the secret.
