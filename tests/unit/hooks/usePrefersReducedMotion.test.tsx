// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

interface MediaQueryMock {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

function stubMatchMedia(matches: boolean): MediaQueryMock {
  const media: MediaQueryMock = {
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(media));
  return media;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("usePrefersReducedMotion", () => {
  it("returns true when the user prefers reduced motion", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("returns false when motion is not reduced", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("subscribes to matchMedia changes", () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    const changeHandler = media.addEventListener.mock.calls[0]?.[1] as () => void;
    expect(changeHandler).toBeTypeOf("function");

    media.matches = true;
    act(() => changeHandler());
    expect(result.current).toBe(true);
  });

  it("unsubscribes from matchMedia on unmount", () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    unmount();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("returns false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});
