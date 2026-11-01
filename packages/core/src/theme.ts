/**
 * Theme configuration for checkout and branding.
 * Merchants can customize colors, typography, and borders.
 */
export interface Theme {
  colors: {
    /** Primary action color (buttons, links) */
    accent: string;
    /** Page background */
    background: string;
    /** Card/paper background */
    surface: string;
    /** Primary text color */
    text: string;
    /** Secondary/muted text color */
    textMuted: string;
    /** Border and divider color */
    border: string;
    /** Error/danger state color */
    danger: string;
  };
  typography?: {
    /** Font family (web-safe or system fonts) */
    fontFamily?: string;
  };
  borders?: {
    /** Border radius in px or rem */
    radius?: string;
  };
}

/**
 * Default dark theme (current design).
 */
export const defaultTheme: Theme = {
  colors: {
    accent: "#d7b56d",
    background: "#0c0b09",
    surface: "#16140f",
    text: "#f3efe4",
    textMuted: "#9a9283",
    border: "#2c281f",
    danger: "#d97a5a",
  },
  typography: {
    fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, serif',
  },
  borders: {
    radius: "16px",
  },
};

/**
 * Validate hex color format.
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Validate theme configuration.
 * Returns error message or null if valid.
 */
export function validateTheme(theme: Partial<Theme>): string | null {
  if (!theme.colors) {
    return null; // Partial theme is ok
  }

  const colorKeys = ["accent", "background", "surface", "text", "textMuted", "border", "danger"] as const;

  for (const key of colorKeys) {
    const color = theme.colors[key];
    if (color && !isValidHexColor(color)) {
      return `Invalid color format for ${key}: ${color}. Use #RRGGBB format.`;
    }
  }

  // Validate contrast for accessibility (basic check)
  if (theme.colors.background && theme.colors.text) {
    const bgLuminance = getRelativeLuminance(theme.colors.background);
    const textLuminance = getRelativeLuminance(theme.colors.text);
    const contrast = (Math.max(bgLuminance, textLuminance) + 0.05) / (Math.min(bgLuminance, textLuminance) + 0.05);

    if (contrast < 4.5) {
      return `Insufficient contrast between background and text (${contrast.toFixed(2)}:1). Minimum is 4.5:1 for accessibility.`;
    }
  }

  return null;
}

/**
 * Calculate relative luminance for contrast ratio.
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb.map((channel) => {
    const sRGB = channel / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/**
 * Convert hex color to RGB array.
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) {
    return [0, 0, 0];
  }
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}

/**
 * Merge partial theme with defaults.
 */
export function mergeTheme(partial: Partial<Theme> | null | undefined): Theme {
  if (!partial) {
    return defaultTheme;
  }

  return {
    colors: {
      ...defaultTheme.colors,
      ...partial.colors,
    },
    typography: {
      ...defaultTheme.typography,
      ...partial.typography,
    },
    borders: {
      ...defaultTheme.borders,
      ...partial.borders,
    },
  };
}

/**
 * Convert theme to CSS custom properties.
 */
export function themeToCssVariables(theme: Theme): Record<string, string> {
  return {
    "--accent": theme.colors.accent,
    "--bg": theme.colors.background,
    "--paper": theme.colors.surface,
    "--ink": theme.colors.text,
    "--muted": theme.colors.textMuted,
    "--line": theme.colors.border,
    "--danger": theme.colors.danger,
    ...(theme.typography?.fontFamily && { "--font-family": theme.typography.fontFamily }),
    ...(theme.borders?.radius && { "--border-radius": theme.borders.radius }),
  };
}
