import { describe, expect, it } from "vitest";
import { defaultTheme, isValidHexColor, mergeTheme, themeToCssVariables, validateTheme } from "../src/theme.ts";
import type { Theme } from "../src/theme.ts";

describe("theme validation", () => {
  it("validates hex colors", () => {
    expect(isValidHexColor("#ffffff")).toBe(true);
    expect(isValidHexColor("#000000")).toBe(true);
    expect(isValidHexColor("#d7b56d")).toBe(true);
    expect(isValidHexColor("#FFF")).toBe(false); // Too short
    expect(isValidHexColor("ffffff")).toBe(false); // Missing #
    expect(isValidHexColor("#gggggg")).toBe(false); // Invalid chars
    expect(isValidHexColor("#ffffff00")).toBe(false); // Too long
  });

  it("accepts valid theme", () => {
    const theme: Partial<Theme> = {
      colors: {
        accent: "#d7b56d",
        background: "#0c0b09",
        surface: "#16140f",
        text: "#f3efe4",
        textMuted: "#9a9283",
        border: "#2c281f",
        danger: "#d97a5a",
      },
    };
    expect(validateTheme(theme)).toBeNull();
  });

  it("rejects invalid color format", () => {
    const theme: Partial<Theme> = {
      colors: {
        accent: "red", // Not hex
        background: "#0c0b09",
        surface: "#16140f",
        text: "#f3efe4",
        textMuted: "#9a9283",
        border: "#2c281f",
        danger: "#d97a5a",
      },
    };
    expect(validateTheme(theme)).toContain("Invalid color format");
  });

  it("rejects insufficient contrast", () => {
    const theme: Partial<Theme> = {
      colors: {
        accent: "#d7b56d",
        background: "#0c0b09", // Very dark
        surface: "#16140f",
        text: "#0d0d0d", // Also very dark - poor contrast
        textMuted: "#9a9283",
        border: "#2c281f",
        danger: "#d97a5a",
      },
    };
    const result = validateTheme(theme);
    expect(result).toContain("Insufficient contrast");
  });

  it("accepts partial theme without colors", () => {
    const theme: Partial<Theme> = {
      typography: {
        fontFamily: "Arial, sans-serif",
      },
    };
    expect(validateTheme(theme)).toBeNull();
  });
});

describe("theme merging", () => {
  it("returns default theme when null", () => {
    expect(mergeTheme(null)).toEqual(defaultTheme);
    expect(mergeTheme(undefined)).toEqual(defaultTheme);
  });

  it("merges partial theme with defaults", () => {
    const partial: Partial<Theme> = {
      colors: {
        accent: "#ff0000",
        background: defaultTheme.colors.background,
        surface: defaultTheme.colors.surface,
        text: defaultTheme.colors.text,
        textMuted: defaultTheme.colors.textMuted,
        border: defaultTheme.colors.border,
        danger: defaultTheme.colors.danger,
      },
    };

    const merged = mergeTheme(partial);
    expect(merged.colors.accent).toBe("#ff0000");
    expect(merged.colors.background).toBe(defaultTheme.colors.background);
    expect(merged.typography?.fontFamily).toBe(defaultTheme.typography?.fontFamily);
  });

  it("preserves all default values for empty partial", () => {
    const partial: Partial<Theme> = {};
    const merged = mergeTheme(partial);
    expect(merged).toEqual(defaultTheme);
  });
});

describe("theme to CSS variables", () => {
  it("converts theme to CSS custom properties", () => {
    const vars = themeToCssVariables(defaultTheme);

    expect(vars["--accent"]).toBe("#d7b56d");
    expect(vars["--bg"]).toBe("#0c0b09");
    expect(vars["--paper"]).toBe("#16140f");
    expect(vars["--ink"]).toBe("#f3efe4");
    expect(vars["--muted"]).toBe("#9a9283");
    expect(vars["--line"]).toBe("#2c281f");
    expect(vars["--danger"]).toBe("#d97a5a");
    expect(vars["--font-family"]).toBe(defaultTheme.typography?.fontFamily);
    expect(vars["--border-radius"]).toBe(defaultTheme.borders?.radius);
  });

  it("omits undefined typography and borders", () => {
    const theme: Theme = {
      colors: defaultTheme.colors,
    };

    const vars = themeToCssVariables(theme);
    expect(vars["--font-family"]).toBeUndefined();
    expect(vars["--border-radius"]).toBeUndefined();
    expect(vars["--accent"]).toBe("#d7b56d");
  });
});

describe("default theme", () => {
  it("has valid color formats", () => {
    expect(isValidHexColor(defaultTheme.colors.accent)).toBe(true);
    expect(isValidHexColor(defaultTheme.colors.background)).toBe(true);
    expect(isValidHexColor(defaultTheme.colors.surface)).toBe(true);
    expect(isValidHexColor(defaultTheme.colors.text)).toBe(true);
    expect(isValidHexColor(defaultTheme.colors.textMuted)).toBe(true);
    expect(isValidHexColor(defaultTheme.colors.border)).toBe(true);
    expect(isValidHexColor(defaultTheme.colors.danger)).toBe(true);
  });

  it("passes validation", () => {
    expect(validateTheme(defaultTheme)).toBeNull();
  });

  it("has sufficient contrast", () => {
    // Default theme should have good contrast
    const result = validateTheme(defaultTheme);
    expect(result).toBeNull();
  });
});
