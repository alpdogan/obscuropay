export function isProduction(env: Env): boolean {
  return String(env.ENVIRONMENT) === "production";
}
