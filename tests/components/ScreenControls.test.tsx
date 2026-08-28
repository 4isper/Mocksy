// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ScreenControls } from "@/components/editor/ScreenControls";
import { DEFAULT_SCREEN_CHROME } from "@/lib/state/editorScene";
import type { ScreenChrome } from "@/lib/types/editor";

afterEach(() => {
  cleanup();
});

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
    expect(toggles).toHaveLength(8); // master + 5 flags + glare + floor reflection
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
    const glareToggle = screen.getAllByRole("checkbox")[6]!;
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
    // clock and date are lock-only
    expect(toggles[2]).toBeDisabled();
    expect(toggles[3]).toBeDisabled();
    // dock stays enabled for home
    expect(toggles[4]).not.toBeDisabled();
  });

  it("disables the dock toggle when the lock style is active", () => {
    render(<ScreenControls {...props} />);
    const toggles = screen.getAllByRole("checkbox");
    expect(toggles[4]).toBeDisabled();
  });

  it("disables everything when the master toggle is off", () => {
    render(<ScreenControls {...props} screen={{ ...DEFAULT_SCREEN_CHROME, enabled: false }} />);
    // master toggle stays interactive; all screen-chrome flags are disabled
    const toggles = screen.getAllByRole("checkbox");
    expect(toggles[0]).not.toBeDisabled();
    // The 5 screen-chrome flags disable with the master; glare and floor
    // reflection are independent effects and stay interactive.
    for (const el of toggles.slice(1, 6)) {
      expect(el).toBeDisabled();
    }
    expect(toggles[6]).not.toBeDisabled(); // glare
    expect(toggles[7]).not.toBeDisabled(); // floor reflection
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
    const floorToggle = screen.getAllByRole("checkbox")[7]!;
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
});

