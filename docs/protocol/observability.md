# Observability (Phase 14)

Platform logs are structured JSON. Every request gets `X-Request-Id` (echoed if the client sent one). Paths and status are logged. Request bodies, cookies, bot tokens, webhook secrets, wallets, and Telegram chat ids are redacted.

`GET /health` — process is up.  
`GET /ready` — D1 answers `SELECT 1`.

OpenTelemetry export is not wired yet. Field names (`request_id`, `ms`, `error_class`) are chosen so a later collector can ingest them without renaming.
