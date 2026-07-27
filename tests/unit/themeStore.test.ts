import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_WINDOW = globalThis.window;
const ORIGINAL_DOCUMENT = globalThis.document;
const ORIGINAL_LOCALSTORAGE = globalThis.localStorage;

function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    raw: map
  };
}

const storage = makeStorage();

// Stub localStorage BEFORE importing themeStore so persist middleware captures it
vi.stubGlobal("localStorage", storage);

const { useThemeStore } = await import("@/lib/state/themeStore");

function stubWindow(prefersDark: boolean) {
  const mediaQuery = {
    matches: prefersDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      matchMedia: vi.fn().mockReturnValue(mediaQuery),
      localStorage: storage,
      __themeCleanup: undefined
    }
  });
  // Also stub window.localStorage explicitly
  Object.defineProperty(globalThis.window, "localStorage", {
    configurable: true,
    value: storage
  });
  return mediaQuery;
}

function stubDocument() {
  const root = {
    classList: { add: vi.fn(), remove: vi.fn() },
    style: {} as Record<string, string>
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { documentElement: root }
  });
  return root;
}

describe("themeStore", () => {
  let mediaQuery: ReturnType<typeof stubWindow>;
  let docRoot: ReturnType<typeof stubDocument>;

  beforeEach(() => {
    storage.clear();
    mediaQuery = stubWindow(false);
    docRoot = stubDocument();
    useThemeStore.setState({ mode: "system", resolvedTheme: "dark" });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: ORIGINAL_WINDOW });
    Object.defineProperty(globalThis, "document", { configurable: true, value: ORIGINAL_DOCUMENT });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: ORIGINAL_LOCALSTORAGE });
    vi.unstubAllGlobals();
  });

  it("defaults to system mode with dark resolvedTheme", () => {
    const state = useThemeStore.getState();
    expect(state.mode).toBe("system");
    expect(state.resolvedTheme).toBe("dark");
  });

  it("setMode light resolves to light and applies theme", () => {
    useThemeStore.getState().setMode("light");
    const state = useThemeStore.getState();
    expect(state.mode).toBe("light");
    expect(state.resolvedTheme).toBe("light");
    expect(docRoot.classList.add).toHaveBeenCalledWith("light");
    expect(docRoot.classList.remove).toHaveBeenCalledWith("light", "dark");
  });

  it("setMode dark resolves to dark and applies theme", () => {
    useThemeStore.getState().setMode("dark");
    const state = useThemeStore.getState();
    expect(state.mode).toBe("dark");
    expect(state.resolvedTheme).toBe("dark");
    expect(docRoot.classList.add).toHaveBeenCalledWith("dark");
  });

  it("setMode system resolves based on matchMedia", () => {
    mediaQuery.matches = true;
    useThemeStore.getState().setMode("system");
    const state = useThemeStore.getState();
    expect(state.mode).toBe("system");
    expect(state.resolvedTheme).toBe("dark");
    expect(docRoot.classList.add).toHaveBeenCalledWith("dark");
  });

  it("setMode system resolves to light when prefers-color-scheme is light", () => {
    mediaQuery.matches = false;
    useThemeStore.getState().setMode("system");
    const state = useThemeStore.getState();
    expect(state.resolvedTheme).toBe("light");
    expect(docRoot.classList.add).toHaveBeenCalledWith("light");
  });

  it("initialize resolves system theme and applies it", () => {
    mediaQuery.matches = true;
    useThemeStore.setState({ mode: "system", resolvedTheme: "light" });
    useThemeStore.getState().initialize();
    const state = useThemeStore.getState();
    expect(state.resolvedTheme).toBe("dark");
    expect(docRoot.classList.add).toHaveBeenCalledWith("dark");
  });

  it("initialize with light mode applies light theme", () => {
    useThemeStore.setState({ mode: "light", resolvedTheme: "dark" });
    useThemeStore.getState().initialize();
    const state = useThemeStore.getState();
    expect(state.resolvedTheme).toBe("light");
    expect(docRoot.classList.add).toHaveBeenCalledWith("light");
  });

  it("initialize registers media query listener when mode is system", () => {
    useThemeStore.setState({ mode: "system", resolvedTheme: "dark" });
    useThemeStore.getState().initialize();
    expect(mediaQuery.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("initialize does not register listener when mode is not system", () => {
    useThemeStore.setState({ mode: "dark", resolvedTheme: "dark" });
    useThemeStore.getState().initialize();
    expect(mediaQuery.addEventListener).not.toHaveBeenCalled();
  });
});