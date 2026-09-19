import { describe, expect, it } from "vitest";
import { FORBIDDEN_CLAIMS, privacyCopy } from "./privacy.ts";

describe("privacy center copy", () => {
  it("explains the three planes and refuses untraceable-money claims", () => {
    const copy = privacyCopy();
    expect(copy).toContain("Customer");
    expect(copy).toContain("merchant by default");
    expect(copy).toContain("Service data");
    expect(copy).toContain("Payment data");
    expect(copy).toContain("Blockchain data");
    expect(copy).toContain("Telegram");
    expect(copy).toContain("7 days");
    for (const claim of FORBIDDEN_CLAIMS) {
      expect(copy.toLowerCase()).not.toContain(claim);
    }
  });
});
