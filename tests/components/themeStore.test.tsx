// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { useThemeStore } from "@/lib/state/themeStore";

describe("themeStore (happy-dom)", () => {
  it("covers partialize on state change", () => {
    useThemeStore.getState().setMode("dark");
    const saved = JSON.parse(localStorage.getItem("mocksy-theme") ?? "{}");
    expect(saved.state).toEqual({ mode: "dark" });
  });

  it("covers module-level setTimeout execution", () => {
    expect(typeof window).toBe("object");
    const saved = localStorage.getItem("mocksy-theme");
    expect(saved).not.toBeNull();
  });

  it("covers initialize with media query listener", () => {
    const addEventListener = vi.fn();
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      addEventListener,
      removeEventListener: vi.fn()
    } as any);
    useThemeStore.setState({ mode: "system" });
    useThemeStore.getState().initialize();
    expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("sets __themeCleanup on window", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any);
    useThemeStore.setState({ mode: "system" });
    useThemeStore.getState().initialize();
    expect((window as any).__themeCleanup).toBeDefined();
    expect(typeof (window as any).__themeCleanup).toBe("function");
  });
});
