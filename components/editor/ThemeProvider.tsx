"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/lib/state/themeStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const initialize = useThemeStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <>{children}</>;
}