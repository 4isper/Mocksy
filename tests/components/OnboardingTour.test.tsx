// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OnboardingTour, ONBOARDING_SEEN_KEY, hasSeenOnboarding } from "@/components/editor/OnboardingTour";
import { useEditorStore } from "@/lib/state/editorStore";

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(ONBOARDING_SEEN_KEY);
  useEditorStore.setState({ onboardingOpen: false });
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
});
