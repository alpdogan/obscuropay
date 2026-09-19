export function checkoutOrigin(env: Env): string {
  return (env.CHECKOUT_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
}

export function publicOrigin(env: Env, requestUrl: string): string {
  return (env.PLATFORM_PUBLIC_ORIGIN ?? new URL(requestUrl).origin).replace(/\/$/, "");
}

export function checkoutPayUrl(env: Env, paymentId: string): string {
  return `${checkoutOrigin(env)}/pay/${paymentId}`;
}
