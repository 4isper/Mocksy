"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  resolvedTheme: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  initialize: () => void;
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return getSystemTheme();
  return mode;
}

function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "system",
      resolvedTheme: "dark",
      setMode: (mode) => {
        const resolved = resolveTheme(mode);
        applyTheme(resolved);
        // Switching into "system" must track OS theme changes; switching away
        // must drop any prior subscription so a manual light/dark choice stays
        // put. initialize() only registers the listener at load time, so a
        // runtime switch to "system" would otherwise freeze the resolved theme.
        const cleanup = (window as Window & { __themeCleanup?: () => void }).__themeCleanup;
        cleanup?.();
        if (mode === "system" && typeof window !== "undefined") {
          const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
          const handler = () => {
            const { mode: m } = get();
            if (m === "system") {
              const r = getSystemTheme();
              applyTheme(r);
              set({ resolvedTheme: r });
            }
          };
          mediaQuery.addEventListener("change", handler);
          (window as Window & { __themeCleanup?: () => void }).__themeCleanup = () =>
            mediaQuery.removeEventListener("change", handler);
        }
        set({ mode, resolvedTheme: resolved });
      },
      initialize: () => {
        const { mode } = get();
        const resolved = resolveTheme(mode);
        applyTheme(resolved);
        set({ resolvedTheme: resolved });

        if (typeof window !== "undefined" && mode === "system") {
          const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
          const handler = () => {
            const { mode } = get();
            if (mode === "system") {
              const resolved = getSystemTheme();
              applyTheme(resolved);
              set({ resolvedTheme: resolved });
            }
          };
          mediaQuery.addEventListener("change", handler);
          // Store cleanup function in window for potential cleanup (not strictly needed for this simple case)
          (window as Window & { __themeCleanup?: () => void }).__themeCleanup = () =>
            mediaQuery.removeEventListener("change", handler);
        }
      }
    }),
    {
      name: "mocksy-theme",
      partialize: (state) => ({ mode: state.mode })
    }
  )
);

// Initialize on client side
if (typeof window !== "undefined") {
  // Small delay to ensure hydration is complete
  setTimeout(() => useThemeStore.getState().initialize(), 0);
}