import { describe, expect, it } from "vitest";
import { AesGcmSecretBox, secretHint } from "../src/secrets/box.ts";

describe("AesGcmSecretBox", () => {
  it("round-trips plaintext", async () => {
    const box = new AesGcmSecretBox(crypto.getRandomValues(new Uint8Array(32)));
    const cipher = await box.encrypt("Bearer super-secret");
    expect(cipher).not.toContain("super-secret");
    expect(await box.decrypt(cipher)).toBe("Bearer super-secret");
  });

  it("redacts hints", () => {
    expect(secretHint("sk_live_abcd")).toBe("••••abcd");
    expect(secretHint("ab")).toBe("••••");
  });
});
