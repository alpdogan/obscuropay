"use client";

import { defaultTheme } from "@obscurus/core";
import type { Theme } from "@obscurus/core";
import { useState } from "react";

export function ThemeEditor({ initialTheme }: { initialTheme?: Theme | null }) {
  const theme = initialTheme || defaultTheme;
  const [colors, setColors] = useState(theme.colors);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveTheme() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/branding/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: { colors } }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save theme");
      } else {
        setMessage("Theme saved! Changes will appear on your checkout pages.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save theme");
    } finally {
      setSaving(false);
    }
  }

  function updateColor(key: keyof typeof colors, value: string) {
    setColors((prev) => ({ ...prev, [key]: value }));
  }

  function resetToDefault() {
    setColors(defaultTheme.colors);
    setMessage("Reset to default theme");
  }

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <h3 style={{ marginBottom: "1rem" }}>Checkout Theme</h3>
      <p className="muted" style={{ marginBottom: "1.5rem" }}>
        Customize the colors of your checkout page. Changes apply to all checkout sessions.
      </p>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div>
          <label>
            Accent Color
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
              <input
                type="color"
                value={colors.accent}
                onChange={(e) => updateColor("accent", e.target.value)}
                style={{ width: "48px", height: "38px", cursor: "pointer" }}
              />
              <input
                type="text"
                value={colors.accent}
                onChange={(e) => updateColor("accent", e.target.value)}
                placeholder="#d7b56d"
                style={{ flex: 1, marginTop: 0, marginBottom: 0 }}
              />
            </div>
          </label>
        </div>

        <div>
          <label>
            Background Color
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
              <input
                type="color"
                value={colors.background}
                onChange={(e) => updateColor("background", e.target.value)}
                style={{ width: "48px", height: "38px", cursor: "pointer" }}
              />
              <input
                type="text"
                value={colors.background}
                onChange={(e) => updateColor("background", e.target.value)}
                placeholder="#0c0b09"
                style={{ flex: 1, marginTop: 0, marginBottom: 0 }}
              />
            </div>
          </label>
        </div>

        <div>
          <label>
            Surface Color
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
              <input
                type="color"
                value={colors.surface}
                onChange={(e) => updateColor("surface", e.target.value)}
                style={{ width: "48px", height: "38px", cursor: "pointer" }}
              />
              <input
                type="text"
                value={colors.surface}
                onChange={(e) => updateColor("surface", e.target.value)}
                placeholder="#16140f"
                style={{ flex: 1, marginTop: 0, marginBottom: 0 }}
              />
            </div>
          </label>
        </div>

        <div>
          <label>
            Text Color
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
              <input
                type="color"
                value={colors.text}
                onChange={(e) => updateColor("text", e.target.value)}
                style={{ width: "48px", height: "38px", cursor: "pointer" }}
              />
              <input
                type="text"
                value={colors.text}
                onChange={(e) => updateColor("text", e.target.value)}
                placeholder="#f3efe4"
                style={{ flex: 1, marginTop: 0, marginBottom: 0 }}
              />
            </div>
          </label>
        </div>

        <div>
          <label>
            Muted Text Color
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
              <input
                type="color"
                value={colors.textMuted}
                onChange={(e) => updateColor("textMuted", e.target.value)}
                style={{ width: "48px", height: "38px", cursor: "pointer" }}
              />
              <input
                type="text"
                value={colors.textMuted}
                onChange={(e) => updateColor("textMuted", e.target.value)}
                placeholder="#9a9283"
                style={{ flex: 1, marginTop: 0, marginBottom: 0 }}
              />
            </div>
          </label>
        </div>

        <div>
          <label>
            Border Color
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
              <input
                type="color"
                value={colors.border}
                onChange={(e) => updateColor("border", e.target.value)}
                style={{ width: "48px", height: "38px", cursor: "pointer" }}
              />
              <input
                type="text"
                value={colors.border}
                onChange={(e) => updateColor("border", e.target.value)}
                placeholder="#2c281f"
                style={{ flex: 1, marginTop: 0, marginBottom: 0 }}
              />
            </div>
          </label>
        </div>

        <div>
          <label>
            Danger Color
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
              <input
                type="color"
                value={colors.danger}
                onChange={(e) => updateColor("danger", e.target.value)}
                style={{ width: "48px", height: "38px", cursor: "pointer" }}
              />
              <input
                type="text"
                value={colors.danger}
                onChange={(e) => updateColor("danger", e.target.value)}
                placeholder="#d97a5a"
                style={{ flex: 1, marginTop: 0, marginBottom: 0 }}
              />
            </div>
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
        <button type="button" onClick={() => void saveTheme()} disabled={saving}>
          {saving ? "Saving..." : "Save Theme"}
        </button>
        <button type="button" onClick={resetToDefault} disabled={saving} className="secondary">
          Reset to Default
        </button>
      </div>

      {message ? <p style={{ color: "var(--accent)", marginTop: "1rem" }}>{message}</p> : null}
      {error ? <p className="error" style={{ marginTop: "1rem" }}>{error}</p> : null}

      <p className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
        Colors must be in hex format (#RRGGBB). The system validates contrast for accessibility (minimum 4.5:1 ratio).
      </p>
    </div>
  );
}
