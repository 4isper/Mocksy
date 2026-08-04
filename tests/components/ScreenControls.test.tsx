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
    setScreenChrome: vi.fn()
  };

  it("renders the master toggle and all sub-toggles", () => {
    render(<ScreenControls {...props} />);
    const toggles = screen.getAllByRole("checkbox");
    expect(toggles).toHaveLength(6); // master + 5 flags
  });

  it("calls setScreenChrome when the master toggle is flipped", async () => {
    const setScreenChrome = vi.fn();
    render(<ScreenControls {...props} setScreenChrome={setScreenChrome} />);
    await userEvent.click(screen.getAllByRole("checkbox")[0]!);
    expect(setScreenChrome).toHaveBeenCalledWith({ enabled: false });
  });

  it("renders the style and theme segmented groups", () => {
    render(<ScreenControls {...props} />);
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.getByText("editor.screenStyleLock")).toBeInTheDocument();
    expect(screen.getByText("editor.screenStyleHome")).toBeInTheDocument();
    expect(screen.getByText("editor.screenStyleStatusBar")).toBeInTheDocument();
    expect(screen.getByText("editor.screenThemeDark")).toBeInTheDocument();
    expect(screen.getByText("editor.screenThemeLight")).toBeInTheDocument();
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
    // master toggle stays interactive; all sub-toggles are disabled
    const toggles = screen.getAllByRole("checkbox");
    expect(toggles[0]).not.toBeDisabled();
    for (const el of toggles.slice(1)) {
      expect(el).toBeDisabled();
    }
    for (const el of screen.getAllByRole("group").flatMap((g) => Array.from(g.querySelectorAll("button")))) {
      expect(el).toBeDisabled();
    }
    expect(screen.getByDisplayValue("9:41")).toBeDisabled();
    expect(screen.getByDisplayValue("Tuesday, August 4")).toBeDisabled();
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
