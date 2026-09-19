// Secrets and test-only bindings are not emitted by `wrangler types`.
interface Env {
  SECRET_KEK: string;
  ENVIRONMENT: string;
  TEST_MIGRATIONS?: { name: string; queries: string[] }[];
}

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}
