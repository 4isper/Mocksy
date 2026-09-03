// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OnboardingTour, ONBOARDING_SEEN_KEY, hasSeenOnboarding } from "@/components/editor/OnboardingTour";
import { useEditorStore } from "@/lib/state/editorStore";

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(ONBOARDING_SEEN_KEY);
  useEditorStore.setState({ onboardingOpen: false, mobileSheet: null });
});

describe("OnboardingTour", () => {
  it("renders nothing when closed", () => {
    render(<OnboardingTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the welcome step when opened and advances through steps", () => {
    useEditorStore.setState({ onboardingOpen: true });
    render(<OnboardingTour />);

    expect(screen.getByRole("dialog")).toHaveTextContent("onboarding.welcomeTitle");
    expect(screen.getByText("onboarding.welcomeBody")).toBeInTheDocument();

    // Step 2 targets the preview canvas.
    fireEvent.click(screen.getByRole("button", { name: "onboarding.next" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("onboarding.canvasTitle");

    // Back returns to the welcome card.
    fireEvent.click(screen.getByRole("button", { name: "onboarding.back" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("onboarding.welcomeTitle");
  });

  it("marks the tour as seen when finished via Done on the last step", () => {
    useEditorStore.setState({ onboardingOpen: true });
    render(<OnboardingTour />);

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: "onboarding.next" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "onboarding.done" }));

    expect(useEditorStore.getState().onboardingOpen).toBe(false);
    expect(window.localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe("1");
  });

  it("marks the tour as seen when skipped and closes on Escape", async () => {
    useEditorStore.setState({ onboardingOpen: true });
    render(<OnboardingTour />);

    fireEvent.click(screen.getByRole("button", { name: "onboarding.skip" }));
    expect(useEditorStore.getState().onboardingOpen).toBe(false);
    expect(window.localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe("1");

    // Reopen (act flushes the re-render + effect that binds Escape), then
    // close with Escape — the seen flag stays set.
    await act(async () => {
      useEditorStore.setState({ onboardingOpen: true });
    });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useEditorStore.getState().onboardingOpen).toBe(false);
  });

  it("hasSeenOnboarding is false before any visit", () => {
    window.localStorage.removeItem(ONBOARDING_SEEN_KEY);
    expect(hasSeenOnboarding()).toBe(false);
  });

  it("drops the centering transform once measured so tall targets stay on-screen", () => {
    // Tall left panel that fits neither above nor below the card (the Controls
    // step on a short viewport): provisional placement falls back to centered,
    // and the measured override must clear translate(-50%,-50%) — otherwise
    // the explicit left/top keep the centering shift and the card lands half
    // its own size up-left, off-screen.
    const prevW = window.innerWidth;
    const prevH = window.innerHeight;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    const panel = document.createElement("div");
    panel.className = "control-panel";
    document.body.appendChild(panel);
    const rectSpy = vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
      left: 16, top: 69, width: 280, height: 715, right: 296, bottom: 784, x: 16, y: 69, toJSON: () => ({})
    });
    try {
      useEditorStore.setState({ onboardingOpen: true });
      render(<OnboardingTour />);
      fireEvent.click(screen.getByRole("button", { name: "onboarding.next" }));
      fireEvent.click(screen.getByRole("button", { name: "onboarding.next" }));
      const dialog = screen.getByRole("dialog");
      expect(dialog.style.transform).toBe("none");
      expect(Number.parseFloat(dialog.style.left)).toBeGreaterThanOrEqual(0);
    } finally {
      rectSpy.mockRestore();
      document.body.removeChild(panel);
      Object.defineProperty(window, "innerWidth", { configurable: true, value: prevW });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: prevH });
    }
  });

  it("opens the panel sheet on panel steps and closes it elsewhere", () => {
    // Closed sheets are parked off-viewport, so the tour opens the guided
    // sheet itself — otherwise the spotlight would highlight nothing.
    useEditorStore.setState({ onboardingOpen: true, mobileSheet: null });
    render(<OnboardingTour />);
    const next = () => fireEvent.click(screen.getByRole("button", { name: "onboarding.next" }));

    expect(useEditorStore.getState().mobileSheet).toBeNull(); // welcome
    next();
    expect(useEditorStore.getState().mobileSheet).toBeNull(); // canvas
    next();
    expect(useEditorStore.getState().mobileSheet).toBe("controls"); // controls
    next();
    expect(useEditorStore.getState().mobileSheet).toBe("right"); // panels
    next();
    expect(useEditorStore.getState().mobileSheet).toBeNull(); // done
  });

  it("restores the pre-tour sheet when finished", () => {
    useEditorStore.setState({ onboardingOpen: true, mobileSheet: "right" });
    render(<OnboardingTour />);
    // Welcome step needs no sheet, so the tour parks it meanwhile.
    expect(useEditorStore.getState().mobileSheet).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "onboarding.skip" }));
    expect(useEditorStore.getState().onboardingOpen).toBe(false);
    expect(useEditorStore.getState().mobileSheet).toBe("right");
  });
});
