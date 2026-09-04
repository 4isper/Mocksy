// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { SheetGrabber } from "@/components/editor/SheetGrabber";

function renderGrabber(onDismiss = vi.fn()) {
  const { container } = render(
    <div className="sheet-host is-open">
      <SheetGrabber onDismiss={onDismiss} />
      <div className="panel" />
    </div>
  );
  const host = container.querySelector(".sheet-host") as HTMLElement;
  const grabber = container.querySelector(".sheet-grabber") as HTMLElement;
  vi.spyOn(grabber, "setPointerCapture").mockImplementation(() => {});
  vi.spyOn(grabber, "releasePointerCapture").mockImplementation(() => {});
  return { host, grabber, onDismiss };
}

beforeEach(() => {
  // The velocity threshold reads performance.now(); fake timers make the
  // elapsed time between events deterministic.
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SheetGrabber", () => {
  it("dismisses after a long downward drag", () => {
    const { host, grabber, onDismiss } = renderGrabber();
    fireEvent.pointerDown(grabber, { pointerId: 1, clientY: 100 });
    expect(host.classList.contains("is-dragging")).toBe(true);
    vi.advanceTimersByTime(100);
    fireEvent.pointerMove(grabber, { pointerId: 1, clientY: 230 });
    expect(host.style.transform).toBe("translateY(130px)");
    vi.advanceTimersByTime(100);
    fireEvent.pointerUp(grabber, { pointerId: 1, clientY: 230 });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(host.classList.contains("is-dragging")).toBe(false);
    expect(host.style.transform).toBe("");
  });

  it("dismisses on a fast short flick", () => {
    const { grabber, onDismiss } = renderGrabber();
    fireEvent.pointerDown(grabber, { pointerId: 1, clientY: 100 });
    vi.advanceTimersByTime(50);
    fireEvent.pointerMove(grabber, { pointerId: 1, clientY: 140 });
    fireEvent.pointerUp(grabber, { pointerId: 1, clientY: 140 });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("snaps back for a short slow drag", () => {
    const { grabber, onDismiss } = renderGrabber();
    fireEvent.pointerDown(grabber, { pointerId: 1, clientY: 100 });
    vi.advanceTimersByTime(500);
    fireEvent.pointerMove(grabber, { pointerId: 1, clientY: 130 });
    fireEvent.pointerUp(grabber, { pointerId: 1, clientY: 130 });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("ignores upward drags (never detaches from the open position)", () => {
    const { host, grabber, onDismiss } = renderGrabber();
    fireEvent.pointerDown(grabber, { pointerId: 1, clientY: 100 });
    vi.advanceTimersByTime(100);
    fireEvent.pointerMove(grabber, { pointerId: 1, clientY: 20 });
    expect(host.style.transform).toBe("");
    fireEvent.pointerUp(grabber, { pointerId: 1, clientY: 20 });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("a cancelled drag snaps back without dismissing", () => {
    const { host, grabber, onDismiss } = renderGrabber();
    fireEvent.pointerDown(grabber, { pointerId: 1, clientY: 100 });
    vi.advanceTimersByTime(100);
    fireEvent.pointerMove(grabber, { pointerId: 1, clientY: 300 });
    fireEvent.pointerCancel(grabber, { pointerId: 1, clientY: 300 });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(host.classList.contains("is-dragging")).toBe(false);
  });
});
