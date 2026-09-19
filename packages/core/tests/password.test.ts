import { describe, expect, it } from "vitest";
import { assertEmail, hashPassword, verifyPassword } from "../src/auth/password.ts";

describe("passwords", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("pbkdf2-sha256$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password!!", hash)).toBe(false);
  });

  it("normalizes email", () => {
    expect(assertEmail("  A@Example.COM ")).toBe("a@example.com");
    expect(() => assertEmail("not-an-email")).toThrow();
  });
});
