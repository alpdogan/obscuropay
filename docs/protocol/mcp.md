# MCP adapter (Phase 11)

The same endpoint configuration is published as an MCP tool. MCP does not price, verify, or mark payments paid. It never spends silently.

## Surface

- `GET /v1/integrations/mcp` — merchant server URLs
- `POST /v1/mcp/:projectId` — JSON-RPC 2.0 (`initialize`, `tools/list`, `tools/call`, `ping`)

`person_search` stays `person_search(query: string)` plus description and price metadata. Tools contain no chain, wallet, or contract fields.

## Separate steps

1. **Discovery** — `tools/list`
2. **Payment requirement** — `tools/call` without `payment_id` opens an invocation and returns `payment_required` with `checkout_url`
3. **Authorization** — the customer pays on hosted checkout; `paid=true` / `auto_spend` on the MCP call is rejected
4. **Execution** — `tools/call` with that `payment_id` after verify fulfills the **same** entitlement path as HTTP and Telegram

Spending policy keys (`max_per_call`, `max_per_day`, `allowed_tools`, `allowed_merchants`, `total_budget`) are accepted as a reserved document. They are not enforced yet. `auto_spend` is rejected.
