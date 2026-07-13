"use client";

import { createContext, useContext, useEffect, useState } from "react";

import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  THEME_KEYS,
  THEME_STORAGE_KEY,
  type ThemeKey,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeKey(value: string | null): value is ThemeKey {
  return !!value && (THEME_KEYS as readonly string[]).includes(value);
}

// 讀取 layout.tsx 內聯腳本已在 hydration 前寫入 <html> 的 data-theme，
// 避免 useEffect 內重新計算並二次 setState（觸發 react-hooks/set-state-in-effect）。
function resolveInitialTheme(): ThemeKey {
  if (typeof document === "undefined") return DEFAULT_DARK_THEME;
  const attr = document.documentElement.getAttribute("data-theme");
  if (isThemeKey(attr)) return attr;
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
