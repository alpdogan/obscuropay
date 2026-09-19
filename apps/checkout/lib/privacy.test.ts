import { describe, expect, it } from "vitest";
import { buildPrivacyReport } from "./privacy.ts";

describe("privacy inspector", () => {
  it("tells the truth about merchant and chain visibility", () => {
    const report = buildPrivacyReport({ amount: "0.50", asset: "USDC", serviceName: "person search" });
    expect(report.merchant.find((row) => row.label.includes("wallet"))?.shared).toBe(false);
    expect(report.chain.find((row) => row.label.includes("Payer wallet"))?.shared).toBe(true);
    expect(report.disclaimer).toMatch(/not untraceable/);
    expect(JSON.stringify(report)).not.toMatch(/anonymous cash|sanctions|untraceable money except/i);
  });
});
