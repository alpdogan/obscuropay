import { describe, expect, it } from "vitest";
import { MERCHANT_NAV, paymentHasWalletField } from "./nav.ts";

describe("merchant dashboard nav", () => {
  it("covers the Phase 9 surfaces and never lists customer wallets", () => {
    expect(MERCHANT_NAV.map((item) => item.label)).toEqual([
      "Overview",
      "Endpoints",
      "Integrations",
      "Payments",
      "Invocations",
      "Webhooks",
      "Branding",
      "Developers",
      "Settings",
    ]);
    expect(MERCHANT_NAV.some((item) => /wallet/i.test(item.label + item.href))).toBe(false);
    expect(paymentHasWalletField({ id: "pay_1", amount: "0.50", asset: "USDC", state: "PAID" })).toBe(false);
    expect(paymentHasWalletField({ id: "pay_1", wallet: "0xabc" })).toBe(true);
  });
});
