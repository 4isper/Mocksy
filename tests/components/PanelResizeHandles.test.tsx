// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { PanelResizeHandles } from "@/components/editor/PanelResizeHandles";
import { PANEL_WIDTH_DEFAULTS } from "@/lib/state/panelWidths";

const STORAGE_KEY = "mocksy-panel-widths";

function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function stubGetComputedStyle() {
  // happy-dom's own getPropertyValue re-enters getComputedStyle (infinite
  // recursion), so resolve custom props straight from the element's inline
  // style. Unknown props (columnGap, etc.) fall back to the empty string.
  window.getComputedStyle = ((el: Element) => ({
    getPropertyValue: (prop: string) => (el instanceof HTMLElement ? el.style.getPropertyValue(prop) : ""),
    columnGap: "",
  })) as typeof window.getComputedStyle;
}

function renderHandles(width = 1200) {
  const result = render(
    <div className="editor-grid" style={{ width: `${width}px` }}>
      <PanelResizeHandles />
    </div>
  );
  const grid = result.container.querySelector(".editor-grid") as HTMLElement;
  Object.defineProperty(grid, "clientWidth", { value: width, configurable: true });
  return result;
}

function grid(): HTMLElement {
  return document.querySelector(".editor-grid") as HTMLElement;
}

function handle(side: "left" | "right") {
  return document.querySelector(`[data-side="${side}"]`) as HTMLButtonElement;
}

beforeAll(() => {
  stubGetComputedStyle();
  Element.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.removeItem(STORAGE_KEY);
  document.body.classList.remove("panel-resizing");
});

describe("PanelResizeHandles", () => {
  it("renders two separator handles with default widths", () => {
    stubMatchMedia(true);
    renderHandles();
    expect(handle("left")).toHaveAttribute("role", "separator");
    expect(handle("left")).toHaveAttribute("aria-label", "editor.resizePanel");
    expect(handle("left")).toHaveAttribute("aria-valuenow", String(PANEL_WIDTH_DEFAULTS.left));
    expect(handle("right")).toHaveAttribute("aria-valuenow", String(PANEL_WIDTH_DEFAULTS.right));
    expect(handle("left")).toHaveAttribute("aria-valuemin", "232");
  });

  it("widens the left panel with ArrowLeft and narrows with ArrowRight", () => {
    stubMatchMedia(true);
    renderHandles();
    const left = handle("left");
    left.focus();
    fireEvent.keyDown(left, { key: "ArrowLeft" });
    expect(grid().style.getPropertyValue("--panel-left-w")).toBe("296px");
    fireEvent.keyDown(left, { key: "ArrowRight" });
    expect(grid().style.getPropertyValue("--panel-left-w")).toBe("280px");
  });

  it("multiplies the keyboard step when Shift is held", () => {
    stubMatchMedia(true);
    renderHandles();
    const left = handle("left");
    left.focus();
    fireEvent.keyDown(left, { key: "ArrowLeft", shiftKey: true });
    expect(grid().style.getPropertyValue("--panel-left-w")).toBe("328px");
  });

  it("narrows the right panel with ArrowRight and widens with ArrowLeft", () => {
    stubMatchMedia(true);
    renderHandles();
    const right = handle("right");
    right.focus();
    fireEvent.keyDown(right, { key: "ArrowRight" });
    expect(grid().style.getPropertyValue("--panel-right-w")).toBe("326px");
    fireEvent.keyDown(right, { key: "ArrowLeft" });
    expect(grid().style.getPropertyValue("--panel-right-w")).toBe("310px");
  });

  it("ignores unrelated keys", () => {
    stubMatchMedia(true);
    renderHandles();
    const left = handle("left");
    left.focus();
    fireEvent.keyDown(left, { key: "a" });
    expect(grid().style.getPropertyValue("--panel-left-w")).toBe("");
  });

  it("does nothing when the handle has no editor-grid ancestor", () => {
    stubMatchMedia(true);
    render(<PanelResizeHandles />);
    const left = document.querySelector('[data-side="left"]') as HTMLButtonElement;
    const preventDefault = vi.fn();
    fireEvent.pointerDown(left, { button: 0, clientX: 100, pointerId: 1, preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("does not start a drag below the desktop breakpoint", () => {
    stubMatchMedia(false);
    renderHandles();
    const left = handle("left");
    const preventDefault = vi.fn();
    fireEvent.pointerDown(left, { button: 0, clientX: 100, pointerId: 1, preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("ignores a non-left-button pointer-down", () => {
    stubMatchMedia(true);
    renderHandles();
    const left = handle("left");
    const preventDefault = vi.fn();
    fireEvent.pointerDown(left, { button: 2, clientX: 100, pointerId: 1, preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("resizes by dragging, clamps and persists the width", () => {
    stubMatchMedia(true);
    renderHandles();
    const left = handle("left");
    fireEvent.pointerDown(left, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(left, { clientX: 160 });
    expect(grid().style.getPropertyValue("--panel-left-w")).toBe("340px");
    fireEvent.pointerUp(left);
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, number>;
    expect(saved.left).toBe(340);
    expect(left).toHaveAttribute("aria-valuenow", "340");
  });

  it("cancels a drag back to the start width on Escape", () => {
    stubMatchMedia(true);
    renderHandles();
    const left = handle("left");
    fireEvent.pointerDown(left, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(left, { clientX: 160 });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(grid().style.getPropertyValue("--panel-left-w")).toBe("280px");
  });

  it("resets a panel to its default width on double-click", () => {
    stubMatchMedia(true);
    renderHandles();
    const left = handle("left");
    fireEvent.keyDown(left, { key: "ArrowLeft" });
    expect(grid().style.getPropertyValue("--panel-left-w")).toBe("296px");
    fireEvent.doubleClick(left);
    expect(grid().style.getPropertyValue("--panel-left-w")).toBe("280px");
  });
});