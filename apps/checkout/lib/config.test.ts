import { describe, expect, it } from "vitest";
import { platformUrl, readCheckoutConfig, walletPayEnabled } from "./config.ts";

describe("checkout config", () => {
  it("requires both WalletConnect and the pay contract for on-chain pay", () => {
    const config = readCheckoutConfig({
      NEXT_PUBLIC_PLATFORM_ORIGIN: "http://localhost:8787/",
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "",
      NEXT_PUBLIC_PAY_CONTRACT: "",
    });
    expect(platformUrl(config, "/v1/pay/1")).toBe("http://localhost:8787/v1/pay/1");
    expect(walletPayEnabled(config)).toBe(false);
    expect(
      walletPayEnabled(
        readCheckoutConfig({
          NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "abc",
          NEXT_PUBLIC_PAY_CONTRACT: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        }),
      ),
    ).toBe(true);
  });
});
