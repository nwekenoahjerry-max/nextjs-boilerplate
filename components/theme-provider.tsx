"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
export type ThemePreference = "light" | "dark" | "system";
type ThemeContextValue = { theme: ThemePreference; setTheme: (theme: ThemePreference) => void };
const STORAGE_KEY = "clerkme-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);
function isTheme(value: unknown): value is ThemePreference { return value === "light" || value === "dark" || value === "system"; }
function applyTheme(theme: ThemePreference) {
  const resolved = theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("light");
  useEffect(() => {
    try { const saved = window.localStorage.getItem(STORAGE_KEY); if (isTheme(saved)) setThemeState(saved); } catch {}
    let active = true;
    fetch("/api/preferences", { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        if (!response.ok) return null;
        const data = await response.json() as { preferences?: { theme?: unknown } };
        return isTheme(data.preferences?.theme) ? data.preferences.theme : null;
      })
      .then(saved => {
        if (!active || !saved) return;
        setThemeState(saved);
        try { window.localStorage.setItem(STORAGE_KEY, saved); } catch {}
      }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme(theme);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);
  const setTheme = useCallback((next: ThemePreference) => {
    if (!isTheme(next)) return;
    setThemeState(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch {}
    fetch("/api/preferences", {
      method: "PATCH", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ theme: next })
    }).catch(() => undefined);
  }, []);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useAppearance() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useAppearance must be used inside ThemeProvider.");
  return value;
}
