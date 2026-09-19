export function platformOrigin(): string {
  return (process.env.PLATFORM_ORIGIN ?? "http://localhost:8787").replace(/\/$/, "");
}

export function checkoutOrigin(): string {
  return (process.env.CHECKOUT_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
}

export function checkoutUrl(path: string): string {
  return `${checkoutOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
