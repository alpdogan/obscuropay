"use client";

import { mergeTheme, themeToCssVariables } from "@obscurus/core";
import type { Theme } from "@obscurus/core";
import { useEffect } from "react";

interface ThemeProviderProps {
  theme?: Theme | null;
  children: React.ReactNode;
}

/**
 * Applies merchant theme to checkout page via CSS custom properties.
 * If no theme is provided, default theme is used (current design).
 */
export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  useEffect(() => {
    const merged = mergeTheme(theme);
    const vars = themeToCssVariables(merged);

    // Apply CSS variables to :root
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Cleanup on unmount
    return () => {
      Object.keys(vars).forEach((key) => {
        root.style.removeProperty(key);
      });
    };
  }, [theme]);

  return <>{children}</>;
}
