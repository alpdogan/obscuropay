# Changelog

All notable changes to this project are documented here.

## 0.0.0 — 2026-09-19

MVP phases 0–16 on Cloudflare Workers, D1, and TypeScript.

- Phase 0: architecture book and threat model.
- Phase 1: merchant platform, secrets, SSRF-safe executor.
- Phase 2: cURL importer (parser, not a shell).
- Phase 3: response mapping.
- Phase 4: payment state machine and single-use entitlements.
- Phase 5: `ObscurusPay` Foundry contract (Base Sepolia USDC, not deployed).
- Phase 6: hosted checkout at `/pay/{id}`.
- Phase 7: privacy inspector on checkout.
- Phase 8: merchant branding without merchant scripts.
- Phase 9: merchant dashboard (no customer wallets).
- Phase 10: Telegram adapter; bot token stored as a hint; resume after pay.
- Phase 11: MCP tools; no silent spend.
- Phase 12: Obscurus-native HTTP 402 `payment_required`.
- Phase 13: HMAC webhooks (`X-Obscurus-Signature` + timestamp).
- Phase 14: structured logs, request ids, `/health` and `/ready`.
- Phase 15: public `/privacy` center.
- Phase 16: Apache-2.0 license and OSS hygiene.
