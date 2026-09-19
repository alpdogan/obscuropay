# Telegram adapter (Phase 10)

Telegram is an output/input adapter. It does not price, verify, or mark payments paid.

## Setup

`POST /v1/integrations/telegram` stores the bot token with the existing secret box. The merchant sees a hint only after that write. The complete token is never listed again.

```json
{
  "project_id": "proj_...",
  "endpoint_id": "ept_...",
  "mapping": "/search {{query}}",
  "bot_token": "123456:AAH..."
}
```

`GET /v1/integrations/telegram` returns `command`, `input_field`, `token_hint`, and `webhook_url`. It does not return `bot_token` or `webhook_secret`.

## Flow

1. Telegram posts `POST /v1/telegram/webhook/:id` with `X-Telegram-Bot-Api-Secret-Token`.
2. The adapter parses `/search John Smith` into the endpoint input schema.
3. Core opens an invocation (`source=telegram`) and an `AWAITING_PAYMENT` charge.
4. The bot replies with amount and a hosted checkout button. Chat id stays in `telegram_sessions` (C4). Merchant invocation JSON does not include it.
5. After `verify` + `fulfill`, the **same** invocation resumes. The user does not resend `/search`.
6. The transformed merchant result is sent back to that chat.

## Policy

Production launch still requires a review of Telegram’s paid digital goods rules. Architecture must not depend only on Telegram. Do not treat a Telegram `paid` flag as payment truth.
