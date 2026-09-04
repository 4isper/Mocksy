// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ScreenControls } from "@/components/editor/ScreenControls";
import { DEFAULT_SCREEN_CHROME } from "@/lib/state/editorScene";
import { GRID_ICON_PRESETS } from "@/lib/render/screenChrome";
import type { ScreenChrome } from "@/lib/types/editor";

afterEach(() => {
  cleanup();
  // Section open/closed prefs persist to localStorage — clear them so tests
  // always start from the default (all sections closed).
  window.localStorage.removeItem("mocksy.controlPanel.sections");
});

/** Expands every collapsed panel Section so its controls are visible. */
function openSections() {
  for (const btn of Array.from(document.querySelectorAll("button.section-header"))) {
    if (btn.getAttribute("aria-expanded") === "false") fireEvent.click(btn);
  }
}

describe("ScreenControls", () => {
  const props = {
    screen: { ...DEFAULT_SCREEN_CHROME, enabled: true },
    setScreenChrome: vi.fn(),
    screenGlare: false,
    setScreenGlare: vi.fn(),
    resolvedOs: "ios" as const,
    floorReflection: false,
    setFloorReflection: vi.fn()
  };

  it("renders the master toggle and all sub-toggles", () => {
    render(<ScreenControls {...props} />);
    const toggles = screen.getAllByRole("checkbox");
    expect(toggles).toHaveLength(10); // master + 7 flags + glare + floor reflection
  });

  it("collapses detail sections and expands them on demand", () => {
    render(<ScreenControls {...props} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "home" }} />);
    // Sections stay closed until expanded: their bodies carry the hidden attr.
    const bodies = Array.from(document.querySelectorAll<HTMLElement>(".section-body"));
    expect(bodies.length).toBeGreaterThanOrEqual(4);
    for (const body of bodies) expect(body.hidden).toBe(true);
    openSections();
    // Expanded → bodies become visible; with 4 grid rows = 15 color inputs.
    const opened = Array.from(document.querySelectorAll<HTMLElement>(".section-body"));
    for (const body of opened) expect(body.hidden).toBe(false);
    expect(document.querySelectorAll('input[type="color"]').length).toBe(15);
    // "Show all" reveals the remaining 16 grid rows.
    fireEvent.click(screen.getByText("editor.screenShowAllIcons"));
    expect(document.querySelectorAll('input[type="color"]').length).toBe(31);
  });

  it("calls setScreenChrome when the master toggle is flipped", async () => {
    const setScreenChrome = vi.fn();
    render(<ScreenControls {...props} setScreenChrome={setScreenChrome} />);
    await userEvent.click(screen.getAllByRole("checkbox")[0]!);
    expect(setScreenChrome).toHaveBeenCalledWith({ enabled: false });
  });

  it("toggles the screen glare via its own checkbox", async () => {
    const setScreenGlare = vi.fn();
    render(<ScreenControls {...props} screenGlare={true} setScreenGlare={setScreenGlare} />);
    const glareToggle = screen.getAllByRole("checkbox")[8]!;
    expect((glareToggle as HTMLInputElement).checked).toBe(true);
    await userEvent.click(glareToggle);
    expect(setScreenGlare).toHaveBeenCalledWith(false);
  });

  it("renders the style, theme and OS segmented groups", () => {
    render(<ScreenControls {...props} />);
    expect(screen.getAllByRole("group")).toHaveLength(3);
    expect(screen.getByText("editor.screenStyleLock")).toBeInTheDocument();
    expect(screen.getByText("editor.screenStyleHome")).toBeInTheDocument();
    expect(screen.getByText("editor.screenStyleStatusBar")).toBeInTheDocument();
    expect(screen.getByText("editor.screenThemeDark")).toBeInTheDocument();
    expect(screen.getByText("editor.screenThemeLight")).toBeInTheDocument();
    expect(screen.getByText("editor.screenOsIos")).toBeInTheDocument();
    expect(screen.getByText("editor.screenOsAndroid")).toBeInTheDocument();
    expect(screen.getByText("editor.screenOsDesktop")).toBeInTheDocument();
  });

  it("switches the style through the segmented control", async () => {
    const setScreenChrome = vi.fn();
    render(<ScreenControls {...props} setScreenChrome={setScreenChrome} />);
    await userEvent.click(screen.getByText("editor.screenStyleHome"));
    expect(setScreenChrome).toHaveBeenCalledWith({ style: "home" });
  });

  it("switches the theme through the segmented control", async () => {
    const setScreenChrome = vi.fn();
    render(<ScreenControls {...props} setScreenChrome={setScreenChrome} />);
    await userEvent.click(screen.getByText("editor.screenThemeLight"));
    expect(setScreenChrome).toHaveBeenCalledWith({ theme: "light" });
  });

  it("disables lock-only toggles when the home style is active", () => {
    render(<ScreenControls {...props} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "home" }} />);
    const toggles = screen.getAllByRole("checkbox");
    // clock, date, notifications and lock shortcuts are lock-only
    expect(toggles[2]).toBeDisabled();
    expect(toggles[3]).toBeDisabled();
    expect(toggles[4]).toBeDisabled();
    expect(toggles[5]).toBeDisabled();
    // dock stays enabled for home
    expect(toggles[6]).not.toBeDisabled();
  });

  it("disables the dock toggle when the lock style is active", () => {
    render(<ScreenControls {...props} />);
    const toggles = screen.getAllByRole("checkbox");
    expect(toggles[6]).toBeDisabled();
  });

  it("toggles lock-screen notifications off and on", async () => {
    const setScreenChrome = vi.fn();
    const { rerender } = render(<ScreenControls {...props} setScreenChrome={setScreenChrome} />);
    const notif = screen.getAllByRole("checkbox")[4]!;
    expect((notif as HTMLInputElement).checked).toBe(false);
    await userEvent.click(notif);
    expect(setScreenChrome).toHaveBeenCalledWith({ showNotifications: true });
    rerender(<ScreenControls {...props} setScreenChrome={setScreenChrome} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, showNotifications: true }} />);
    expect((screen.getAllByRole("checkbox")[4]! as HTMLInputElement).checked).toBe(true);
  });

  it("toggles lock-screen shortcuts off and on", async () => {
    const setScreenChrome = vi.fn();
    const { rerender } = render(<ScreenControls {...props} setScreenChrome={setScreenChrome} />);
    const shortcut = screen.getAllByRole("checkbox")[5]!;
    expect((shortcut as HTMLInputElement).checked).toBe(true);
    await userEvent.click(shortcut);
    expect(setScreenChrome).toHaveBeenCalledWith({ showLockShortcuts: false });
    rerender(<ScreenControls {...props} setScreenChrome={setScreenChrome} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, showLockShortcuts: false }} />);
    expect((screen.getAllByRole("checkbox")[5]! as HTMLInputElement).checked).toBe(false);
  });

  it("edits custom notification cards", async () => {
    const setScreenChrome = vi.fn();
    render(
      <ScreenControls
        {...props}
        setScreenChrome={setScreenChrome}
        screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, showNotifications: true, notifications: [{ app: "Instagram", subtitle: "Liked your post", color: "#e1306c" }] }}
      />
    );
    openSections();
    const app = screen.getByLabelText("editor.screenNotificationsApp 1");
    fireEvent.change(app, { target: { value: "Slack" } });
    expect(setScreenChrome).toHaveBeenLastCalledWith({ notifications: [{ app: "Slack", subtitle: "Liked your post", color: "#e1306c" }] });
  });

  it("shows a reset button when notifications are customized", () => {
    render(
      <ScreenControls
        {...props}
        setScreenChrome={vi.fn()}
        screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, showNotifications: true, notifications: [{ app: "Slack", subtitle: "hi", color: "#4a154b" }] }}
      />
    );
    // any customization surfaces the single global reset affordance
    expect(screen.getByText("editor.screenResetAll")).toBeInTheDocument();
  });

  it("edits custom dock icons", () => {
    const setScreenChrome = vi.fn();
    render(
      <ScreenControls
        {...props}
        setScreenChrome={setScreenChrome}
        screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "home", dockIcons: [{ label: "Mail", color: "#ff3b30", emoji: "✉️" }] }}
      />
    );
    openSections();
    const label = screen.getByLabelText("editor.screenDockIconLabel 1");
    fireEvent.change(label, { target: { value: "Camera" } });
    expect(setScreenChrome).toHaveBeenLastCalledWith({ dockIcons: [{ label: "Camera", color: "#ff3b30", emoji: "✉️" }] });
  });

  it("applies a grid icon preset via the preset chips", () => {
    const setScreenChrome = vi.fn();
    render(<ScreenControls {...props} setScreenChrome={setScreenChrome} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "home" }} />);
    openSections();
    const chip = screen.getByText("editor.screenGridPreset.minimal");
    fireEvent.click(chip);
    const minimal = GRID_ICON_PRESETS.find((p) => p.id === "minimal")!;
    expect(setScreenChrome).toHaveBeenLastCalledWith({ androidGridIcons: minimal.icons });
  });

  it("marks the active grid preset chip with aria-pressed", () => {
    // Default icons (null custom list) → "google" is active.
    const { rerender } = render(
      <ScreenControls {...props} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "home" }} />
    );
    openSections();
    expect(screen.getByText("editor.screenGridPreset.google").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("editor.screenGridPreset.minimal").getAttribute("aria-pressed")).toBe("false");
    // After applying "minimal" it becomes the active chip.
    const minimal = GRID_ICON_PRESETS.find((p) => p.id === "minimal")!;
    rerender(
      <ScreenControls {...props} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "home", androidGridIcons: minimal.icons }} />
    );
    expect(screen.getByText("editor.screenGridPreset.minimal").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("editor.screenGridPreset.google").getAttribute("aria-pressed")).toBe("false");
  });

  it("updates grid columns/rows via the dimension sliders", () => {
    const setScreenChrome = vi.fn();
    render(<ScreenControls {...props} setScreenChrome={setScreenChrome} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "home" }} />);
    openSections();
    fireEvent.change(screen.getByLabelText("editor.screenGridCols"), { target: { value: "5" } });
    expect(setScreenChrome).toHaveBeenLastCalledWith({ gridCols: 5 });
    fireEvent.change(screen.getByLabelText("editor.screenGridRows"), { target: { value: "4" } });
    expect(setScreenChrome).toHaveBeenLastCalledWith({ gridRows: 4 });
  });

  it("adds and edits a grid folder", () => {
    const setScreenChrome = vi.fn();
    render(<ScreenControls {...props} setScreenChrome={setScreenChrome} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "home" }} />);
    openSections();
    fireEvent.click(screen.getByText("editor.screenAddFolder"));
    expect(setScreenChrome).toHaveBeenLastCalledWith({ folders: [{ label: "Folder 1", color: "#3a4a5a" }] });
    const label = screen.getByLabelText("editor.screenFolder 1 editor.screenGridLabel");
    fireEvent.change(label, { target: { value: "Games" } });
    expect(setScreenChrome).toHaveBeenLastCalledWith({ folders: [{ label: "Games", color: "#5e35b1" }] });
  });

  it("toggles home widgets on and off", () => {
    const setScreenChrome = vi.fn();
    render(<ScreenControls {...props} setScreenChrome={setScreenChrome} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "home", widgets: [{ type: "clock" }] }} />);
    openSections();
    // Weather is off → add it. (State is mocked, so the prop stays [clock].)
    fireEvent.click(screen.getByText("editor.screenWidgetWeather"));
    expect(setScreenChrome).toHaveBeenLastCalledWith({ widgets: [{ type: "clock" }, { type: "weather" }] });
    // Clock is on → removing it empties the list, which becomes null.
    fireEvent.click(screen.getByText("editor.screenWidgetClock"));
    expect(setScreenChrome).toHaveBeenLastCalledWith({ widgets: null });
  });

  it("disables everything when the master toggle is off", () => {
    render(<ScreenControls {...props} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: false }} />);
    // master toggle stays interactive; all screen-chrome flags are disabled
    const toggles = screen.getAllByRole("checkbox");
    expect(toggles[0]).not.toBeDisabled();
    // The 7 screen-chrome flags disable with the master; glare and floor
    // reflection are independent effects and stay interactive.
    for (const el of toggles.slice(1, 8)) {
      expect(el).toBeDisabled();
    }
    expect(toggles[8]).not.toBeDisabled(); // glare
    expect(toggles[9]).not.toBeDisabled(); // floor reflection
    for (const el of screen.getAllByRole("group").flatMap((g) => Array.from(g.querySelectorAll("button")))) {
      expect(el).toBeDisabled();
    }
    expect(screen.getByDisplayValue("9:41")).toBeDisabled();
    expect(screen.getByDisplayValue("Tuesday, August 4")).toBeDisabled();
  });

  it("switches the device OS through the segmented control", async () => {
    const setScreenChrome = vi.fn();
    render(<ScreenControls {...props} setScreenChrome={setScreenChrome} />);
    await userEvent.click(screen.getByText("editor.screenOsAndroid"));
    expect(setScreenChrome).toHaveBeenCalledWith({ os: "android" });
  });

  it("toggles the floor reflection via its own checkbox", async () => {
    const setFloorReflection = vi.fn();
    render(<ScreenControls {...props} floorReflection={true} setFloorReflection={setFloorReflection} />);
    const floorToggle = screen.getAllByRole("checkbox")[9]!;
    expect((floorToggle as HTMLInputElement).checked).toBe(true);
    await userEvent.click(floorToggle);
    expect(setFloorReflection).toHaveBeenCalledWith(false);
  });

  it("renders reset/apply actions only in instance mode", () => {
    const { rerender } = render(<ScreenControls {...props} />);
    expect(screen.queryByText("editor.screenResetDefault")).not.toBeInTheDocument();
    expect(screen.queryByText("editor.screenApplyToAll")).not.toBeInTheDocument();
    const onResetScreen = vi.fn();
    const onApplyToAll = vi.fn();
    rerender(<ScreenControls {...props} onResetScreen={onResetScreen} onApplyToAll={onApplyToAll} />);
    const resetBtn = screen.getByText("editor.screenResetDefault");
    const applyBtn = screen.getByText("editor.screenApplyToAll");
    expect(resetBtn).toBeInTheDocument();
    expect(applyBtn).toBeInTheDocument();
  });

  it("updates the time and date text fields", () => {
    const setScreenChrome = vi.fn();
    render(<ScreenControls {...props} setScreenChrome={setScreenChrome} />);
    fireEvent.change(screen.getByDisplayValue("9:41"), { target: { value: "10:30" } });
    expect(setScreenChrome).toHaveBeenCalledWith({ time: "10:30" });
    fireEvent.change(screen.getByDisplayValue("Tuesday, August 4"), { target: { value: "Friday, March 1" } });
    expect(setScreenChrome).toHaveBeenCalledWith({ date: "Friday, March 1" });
  });

  it("renders a custom time and date", () => {
    const screenChrome: ScreenChrome = { ...DEFAULT_SCREEN_CHROME, enabled: true, time: "12:00", date: "Monday, January 1" };
    render(<ScreenControls {...props} screen={screenChrome} />);
    expect(screen.getByDisplayValue("12:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Monday, January 1")).toBeInTheDocument();
  });

  it("shows clock-specific controls only in lock style", () => {
    render(<ScreenControls {...props} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "lock" }} />);
    openSections();
    // Clock size and position sliders appear
    expect(screen.getAllByRole("slider")).toHaveLength(2);

    cleanup();
    render(<ScreenControls {...props} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "home" }} />);
    openSections();
    // Lock sliders are replaced by the 2 grid-dimension sliders in home mode.
    expect(screen.queryAllByRole("slider")).toHaveLength(2);
    expect(screen.getByLabelText("editor.screenGridCols")).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByLabelText("editor.screenGridRows")).toBeInstanceOf(HTMLInputElement);
  });

  it("shows dock-specific controls only in home style", () => {
    render(<ScreenControls {...props} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "home" }} />);
    openSections();
    // Home mode with the first 4 grid rows: dock background + 4 dock icon colors
    // + 4 dock-icon tiles + 4 grid-icon tiles + 2 default folder colors = 15 color inputs
    expect(document.querySelectorAll('input[type="color"]').length).toBe(15);
  });

  it("hides dock-specific controls in lock style", () => {
    render(<ScreenControls {...props} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "lock" }} />);
    openSections();
    // Lock mode: only clock color = 1 color input
    const colorInputs = document.querySelectorAll('input[type="color"]');
    expect(colorInputs.length).toBe(1);
  });

  it("resets every customization via the single reset-all button", async () => {
    const setScreenChrome = vi.fn();
    render(
      <ScreenControls
        {...props}
        setScreenChrome={setScreenChrome}
        screen={{ ...DEFAULT_SCREEN_CHROME, enabled: true, style: "lock", clockColor: "#ff0000" }}
      />
    );
    await userEvent.click(screen.getByText("editor.screenResetAll"));
    expect(setScreenChrome).toHaveBeenCalledWith({
      notifications: null,
      clockColor: null,
      clockSizeFactor: null,
      clockYFactor: null,
      dockBackground: null,
      dockColors: null,
      dockIcons: null,
      androidGridIcons: null,
      gridCols: null,
      gridRows: null,
      folders: null,
      widgets: null
    });
  });

  it("hides the reset-all button until something is customized", () => {
    const setScreenChrome = vi.fn();
    render(<ScreenControls {...props} setScreenChrome={setScreenChrome} />);
    expect(screen.queryByText("editor.screenResetAll")).not.toBeInTheDocument();
    const customized = { ...DEFAULT_SCREEN_CHROME, enabled: true, style: "home" as const, dockColors: ["#aabbcc", "#112233", "#ffffff", "#000000"] };
    render(<ScreenControls {...props} setScreenChrome={setScreenChrome} screen={customized} />);
    expect(screen.getByText("editor.screenResetAll")).toBeInTheDocument();
  });
});

