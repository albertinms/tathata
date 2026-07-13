export const THEME_KEYS = ["a", "b", "c", "d"] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];

export const THEME_LABELS: Record<ThemeKey, string> = {
  a: "東方棕金",
  b: "暖金圓潤",
  c: "米白暖光",
  d: "紫金星空",
};

export const DEFAULT_DARK_THEME: ThemeKey = "d";
export const DEFAULT_LIGHT_THEME: ThemeKey = "c";

export const THEME_STORAGE_KEY = "tathata-theme";
