# HTTP 402 (Phase 12)

Public invoke is Obscurus-native. x402 headers and facilitator envelopes are later ([ADR-0010](../architecture/decisions.md#adr-0010--http-402-is-obscurus-native-x402-aware)).

## Request

```http
POST /v1/invoke/person_search
Content-Type: application/json

{ "query": "John" }
```

`POST /v1/invoke/:ref` accepts an endpoint slug or `ept_…` id. If the slug is not unique, send `project_id`.

`POST /v1/invoke` with `{ endpoint_id, input }` still creates a charge and returns `201` for existing clients.

## Unpaid

`402 Payment Required`

```json
{
  "error": "payment_required",
  "payment": {
    "id": "pay_…",
    "amount": "0.50",
    "asset": "USDC",
    "checkout_url": "/pay/pay_…"
  }
}
```

No wallet, chain id, or `PAYMENT-SIGNATURE` in the MVP body.

## Paid

After checkout verify, retry with `payment_id`:

```http
POST /v1/invoke/person_search

{ "query": "John", "payment_id": "pay_…" }
```

`200`

```json
{ "result": … }
```
