// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

function Harness({ active, trapTab = true }: { active: boolean; trapTab?: boolean }) {
  const ref = useFocusTrap(active, trapTab);
  return (
    <div ref={ref}>
      <button data-testid="first">First</button>
      <input data-testid="middle" />
      <button data-testid="last">Last</button>
    </div>
  );
}

afterEach(cleanup);

describe("useFocusTrap", () => {
  it("focuses the first focusable element on activation", () => {
    render(<Harness active />);
    expect(document.activeElement).toBe(screen.getByTestId("first"));
  });

  it("does not move focus when inactive", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    render(<Harness active={false} />);
    expect(document.activeElement).toBe(button);
  });

  it("wraps Tab from the last element to the first", () => {
    render(<Harness active />);
    screen.getByTestId("last").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByTestId("first"));
  });

  it("wraps Shift+Tab from the first element to the last", () => {
    render(<Harness active />);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId("last"));
  });

  it("leaves Tab alone in the middle of the trap", () => {
    render(<Harness active />);
    screen.getByTestId("middle").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByTestId("middle"));
  });

  it("restores focus to the previously focused element on deactivation", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    const { rerender } = render(<Harness active />);
    expect(document.activeElement).toBe(screen.getByTestId("first"));
    rerender(<Harness active={false} />);
    expect(document.activeElement).toBe(button);
  });

  it("does not trap Tab when trapTab is false", () => {
    render(<Harness active trapTab={false} />);
    screen.getByTestId("last").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByTestId("last"));
  });

  it("removes the keydown listener on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<Harness active />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
});
