// Secrets and test-only bindings are not emitted by `wrangler types`.
interface Env {
  SECRET_KEK: string;
  ENVIRONMENT: string;
  CHECKOUT_ORIGIN?: string;
  PLATFORM_PUBLIC_ORIGIN?: string;
  TELEGRAM_STUB?: string;
  WEBHOOK_STUB?: string;
  TEST_MIGRATIONS?: { name: string; queries: string[] }[];
}

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}
