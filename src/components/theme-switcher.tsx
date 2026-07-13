"use client";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { THEME_KEYS, THEME_LABELS } from "@/lib/theme";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-wrap gap-2">
      {THEME_KEYS.map((key) => (
        <Button
          key={key}
          variant={theme === key ? "default" : "outline"}
          size="sm"
          onClick={() => setTheme(key)}
        >
          {THEME_LABELS[key]}
        </Button>
      ))}
    </div>
  );
}
