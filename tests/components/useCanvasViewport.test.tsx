// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasViewport } from "@/lib/hooks/useCanvasViewport";
import { useEditorStore } from "@/lib/state/editorStore";

// happy-dom lacks pointer capture plumbing; stub it so the pan handlers run.
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});

function makeCanvasRef() {
  const el = document.createElement("div");
  Object.defineProperty(el, "offsetWidth", { value: 800, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: 600, configurable: true });
  Object.defineProperty(el, "getBoundingClientRect", {
    value: () => ({ left: 0, top: 0, width: 800, height: 600, x: 0, y: 0, right: 800, bottom: 600, toJSON: () => {} }),
  });
  return { current: el } as React.RefObject<HTMLDivElement | null>;
}

afterEach(() => {
  useEditorStore.setState({
    previewZoom: "fit",
    previewPan: { x: 0, y: 0 },
  });
});

describe("useCanvasViewport", () => {
  it("returns initial state: spaceHeld false, isPanning false, viewCursor undefined", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));
    expect(result.current.spaceHeld).toBe(false);
    expect(result.current.isPanning).toBe(false);
    expect(result.current.viewCursor).toBeUndefined();
  });

  it("sets spaceHeld to true on Space keydown and releases on keyup", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });
    expect(result.current.spaceHeld).toBe(true);
    expect(result.current.viewCursor).toBe("grab");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    });
    expect(result.current.spaceHeld).toBe(false);
    expect(result.current.viewCursor).toBeUndefined();
  });

  it("releases space on window blur", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });
    expect(result.current.spaceHeld).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(result.current.spaceHeld).toBe(false);
  });

  it("does not trigger on Space with metaKey held", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", metaKey: true }));
    });
    expect(result.current.spaceHeld).toBe(false);
  });

  it("does not trigger on repeated keydown", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });
    expect(result.current.spaceHeld).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", repeat: true }));
    });
    expect(result.current.spaceHeld).toBe(true);
  });

  it("wheel event zooms and updates store", () => {
    const canvasRef = makeCanvasRef();
    renderHook(() => useCanvasViewport({ canvasRef }));

    const wheelEvent = new WheelEvent("wheel", {
      deltaY: -100,
      clientX: 400,
      clientY: 300,
      bubbles: true,
    });
    const preventSpy = vi.spyOn(wheelEvent, "preventDefault");

    act(() => {
      canvasRef.current!.dispatchEvent(wheelEvent);
    });

    expect(preventSpy).toHaveBeenCalled();
    const { previewZoom } = useEditorStore.getState();
    expect(previewZoom).not.toBe("fit");
    expect(typeof previewZoom).toBe("number");
  });

  it("wheel event does nothing when zoom would not change", () => {
    const canvasRef = makeCanvasRef();
    renderHook(() => useCanvasViewport({ canvasRef }));
    useEditorStore.setState({ previewZoom: 0.25 });

    const wheelEvent = new WheelEvent("wheel", {
      deltaY: 0,
      clientX: 400,
      clientY: 300,
      bubbles: true,
    });

    act(() => {
      canvasRef.current!.dispatchEvent(wheelEvent);
    });

    expect(useEditorStore.getState().previewZoom).toBe(0.25);
  });

  it("double-click on empty canvas resets view via handler", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));
    useEditorStore.setState({ previewZoom: 2, previewPan: { x: 50, y: 30 } });

    const event = { target: canvasRef.current } as unknown as React.MouseEvent<HTMLDivElement>;
    act(() => {
      result.current.onDoubleClickReset(event);
    });

    expect(useEditorStore.getState().previewZoom).toBe("fit");
    expect(useEditorStore.getState().previewPan).toEqual({ x: 0, y: 0 });
  });

  it("double-click does not reset when already at fit", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));
    useEditorStore.setState({ previewZoom: "fit", previewPan: { x: 0, y: 0 } });

    const setStateSpy = vi.spyOn(useEditorStore, "setState");
    const event = { target: canvasRef.current } as unknown as React.MouseEvent<HTMLDivElement>;
    act(() => {
      result.current.onDoubleClickReset(event);
    });

    expect(setStateSpy).not.toHaveBeenCalled();
    setStateSpy.mockRestore();
  });

  it("double-click on interactive element does not reset", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));
    useEditorStore.setState({ previewZoom: 2, previewPan: { x: 50, y: 30 } });

    const btn = document.createElement("button");
    canvasRef.current!.appendChild(btn);

    const setStateSpy = vi.spyOn(useEditorStore, "setState");
    const event = { target: btn } as unknown as React.MouseEvent<HTMLDivElement>;
    act(() => {
      result.current.onDoubleClickReset(event);
    });

    expect(setStateSpy).not.toHaveBeenCalled();
    setStateSpy.mockRestore();
  });

  it("middle-button mousedown is swallowed to prevent autoscroll", () => {
    const canvasRef = makeCanvasRef();
    renderHook(() => useCanvasViewport({ canvasRef }));

    const mouseEvent = new MouseEvent("mousedown", { button: 1, bubbles: true });
    const preventSpy = vi.spyOn(mouseEvent, "preventDefault");

    act(() => {
      canvasRef.current!.dispatchEvent(mouseEvent);
    });

    expect(preventSpy).toHaveBeenCalled();
  });

  it("pan starts on pointerdown when space is held", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });
    expect(result.current.spaceHeld).toBe(true);

    const pointerEvent = {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      target: canvasRef.current,
      currentTarget: canvasRef.current,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.PointerEvent<HTMLDivElement>;

    act(() => {
      result.current.onPointerDownCapture(pointerEvent);
    });

    expect(result.current.isPanning).toBe(true);
    expect(result.current.viewCursor).toBe("grabbing");
  });

  it("pan does not start on pointerdown without space or middle button", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));

    const pointerEvent = {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      target: canvasRef.current,
      currentTarget: canvasRef.current,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.PointerEvent<HTMLDivElement>;

    act(() => {
      result.current.onPointerDownCapture(pointerEvent);
    });

    expect(result.current.isPanning).toBe(false);
  });

  it("pan does not start on interactive element even with space held", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });

    const btn = document.createElement("button");
    const pointerEvent = {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      target: btn,
      currentTarget: canvasRef.current,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.PointerEvent<HTMLDivElement>;

    act(() => {
      result.current.onPointerDownCapture(pointerEvent);
    });

    expect(result.current.isPanning).toBe(false);
  });

  it("pan updates previewPan during pointermove", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));

    useEditorStore.setState({ previewZoom: 2 });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });

    const downEvent = {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      target: canvasRef.current,
      currentTarget: canvasRef.current,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.PointerEvent<HTMLDivElement>;

    act(() => {
      result.current.onPointerDownCapture(downEvent);
    });

    const moveEvent = {
      clientX: 150,
      clientY: 120,
      pointerId: 1,
      currentTarget: canvasRef.current,
    } as unknown as React.PointerEvent<HTMLDivElement>;

    act(() => {
      result.current.onPointerMove(moveEvent);
    });

    const { previewPan } = useEditorStore.getState();
    expect(previewPan.x).toBe(50);
    expect(previewPan.y).toBe(20);
  });

  it("pan ends on pointerup", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });

    const downEvent = {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      target: canvasRef.current,
      currentTarget: canvasRef.current,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      hasPointerCapture: () => true,
      releasePointerCapture: vi.fn(),
    } as unknown as React.PointerEvent<HTMLDivElement>;

    act(() => {
      result.current.onPointerDownCapture(downEvent);
    });
    expect(result.current.isPanning).toBe(true);

    act(() => {
      result.current.onPointerUp(downEvent as any);
    });

    expect(result.current.isPanning).toBe(false);
  });

  it("pan ends on pointercancel", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });

    const downEvent = {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      target: canvasRef.current,
      currentTarget: canvasRef.current,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      hasPointerCapture: () => false,
      releasePointerCapture: vi.fn(),
    } as unknown as React.PointerEvent<HTMLDivElement>;

    act(() => {
      result.current.onPointerDownCapture(downEvent);
    });
    expect(result.current.isPanning).toBe(true);

    act(() => {
      result.current.onPointerCancel(downEvent as any);
    });

    expect(result.current.isPanning).toBe(false);
  });

  it("touch pinch starts on two-finger touch and updates zoom", () => {
    const canvasRef = makeCanvasRef();
    renderHook(() => useCanvasViewport({ canvasRef }));

    const touchStart = new TouchEvent("touchstart", {
      touches: [
        { clientX: 100, clientY: 100, identifier: 0 } as Touch,
        { clientX: 200, clientY: 200, identifier: 1 } as Touch,
      ],
      bubbles: true,
    });
    act(() => {
      canvasRef.current!.dispatchEvent(touchStart);
    });

    const touchMove = new TouchEvent("touchmove", {
      touches: [
        { clientX: 120, clientY: 120, identifier: 0 } as Touch,
        { clientX: 180, clientY: 180, identifier: 1 } as Touch,
      ],
      bubbles: true,
    });
    const preventSpy = vi.spyOn(touchMove, "preventDefault");
    act(() => {
      canvasRef.current!.dispatchEvent(touchMove);
    });

    expect(preventSpy).toHaveBeenCalled();
    const { previewZoom } = useEditorStore.getState();
    expect(previewZoom).not.toBe("fit");
  });

  it("touch pinch is ignored when starting on content element", () => {
    const canvasRef = makeCanvasRef();
    renderHook(() => useCanvasViewport({ canvasRef }));

    const frame = document.createElement("div");
    frame.setAttribute("data-frame-instance-id", "f1");
    canvasRef.current!.appendChild(frame);

    const touchStart = new TouchEvent("touchstart", {
      touches: [
        { clientX: 100, clientY: 100, identifier: 0 } as Touch,
        { clientX: 200, clientY: 200, identifier: 1 } as Touch,
      ],
      bubbles: true,
    });
    Object.defineProperty(touchStart, "target", { value: frame });
    act(() => {
      frame.dispatchEvent(touchStart);
    });

    const touchMove = new TouchEvent("touchmove", {
      touches: [
        { clientX: 110, clientY: 110, identifier: 0 } as Touch,
        { clientX: 190, clientY: 190, identifier: 1 } as Touch,
      ],
      bubbles: true,
    });
    act(() => {
      canvasRef.current!.dispatchEvent(touchMove);
    });

    expect(useEditorStore.getState().previewZoom).toBe("fit");
  });

  it("touch with single finger does not start view pinch", () => {
    const canvasRef = makeCanvasRef();
    renderHook(() => useCanvasViewport({ canvasRef }));

    const touchStart = new TouchEvent("touchstart", {
      touches: [
        { clientX: 100, clientY: 100, identifier: 0 } as Touch,
      ],
      bubbles: true,
    });
    act(() => {
      canvasRef.current!.dispatchEvent(touchStart);
    });

    expect(useEditorStore.getState().previewZoom).toBe("fit");
  });

  it("middle-button pan via pointerdown (button === 1)", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));

    const pointerEvent = {
      button: 1,
      clientX: 200,
      clientY: 200,
      pointerId: 2,
      target: canvasRef.current,
      currentTarget: canvasRef.current,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.PointerEvent<HTMLDivElement>;

    act(() => {
      result.current.onPointerDownCapture(pointerEvent);
    });

    expect(result.current.isPanning).toBe(true);
  });

  it("double-click on content element does not reset", () => {
    const canvasRef = makeCanvasRef();
    const { result } = renderHook(() => useCanvasViewport({ canvasRef }));
    useEditorStore.setState({ previewZoom: 2, previewPan: { x: 50, y: 30 } });

    const frame = document.createElement("div");
    frame.setAttribute("data-mockup-frame", "true");

    const event = { target: frame } as unknown as React.MouseEvent<HTMLDivElement>;
    act(() => {
      result.current.onDoubleClickReset(event);
    });

    expect(useEditorStore.getState().previewZoom).toBe(2);
  });
});
