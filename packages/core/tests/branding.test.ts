import { describe, expect, it } from "vitest";
import { DomainError } from "../src/errors.ts";
import { assertDisplayName, inspectLogo } from "../src/branding/logo.ts";

describe("merchant branding", () => {
  it("accepts a small PNG and rejects HTML or scripts", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]);
    expect(inspectLogo(png, "image/png")).toBe("image/png");
    expect(assertDisplayName("Acme Search")).toBe("Acme Search");
    expect(() => assertDisplayName("<script>alert(1)</script>")).toThrow(DomainError);
    expect(() => inspectLogo(png, "text/html")).toThrow(/PNG, JPEG, or WebP/);
    expect(() => inspectLogo(new Uint8Array(256 * 1024 + 1), "image/png")).toThrow(/256/);
  });
});
