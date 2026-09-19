export const MERCHANT_NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/endpoints", label: "Endpoints" },
  { href: "/integrations", label: "Integrations" },
  { href: "/payments", label: "Payments" },
  { href: "/invocations", label: "Invocations" },
  { href: "/webhooks", label: "Webhooks" },
  { href: "/branding", label: "Branding" },
  { href: "/developers", label: "Developers" },
  { href: "/settings", label: "Settings" },
] as const;

export function paymentHasWalletField(payment: Record<string, unknown>): boolean {
  const keys = Object.keys(payment).map((key) => key.toLowerCase());
  return keys.some((key) => key.includes("wallet") || key === "address" || key === "payer" || key === "tx_hash");
}
