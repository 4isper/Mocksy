// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useAutosaveStatus } from "@/lib/hooks/useAutosaveStatus";
import { initialScene } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";

afterEach(() => {
  cleanup();
  useProjectsStore.setState({ saveError: null });
  vi.restoreAllMocks();
});

describe("useAutosaveStatus", () => {
  it("persists the scene to the active project after the debounce", async () => {
    const updateSpy = vi.spyOn(useProjectsStore.getState(), "updateActiveProjectScene");
    const bootstrapped = { current: true };
    renderHook(() => useAutosaveStatus(initialScene, null, bootstrapped));
    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy).toHaveBeenCalledWith({ ...initialScene, activeLayerId: null });
  });

  it("saveNow persists immediately and marks saved", async () => {
    const updateSpy = vi.spyOn(useProjectsStore.getState(), "updateActiveProjectScene");
    const bootstrapped = { current: true };
    const { result } = renderHook(() => useAutosaveStatus(initialScene, null, bootstrapped));
    act(() => result.current.saveNow());
    expect(updateSpy).toHaveBeenCalled();
    expect(result.current.saved).toBe(true);
    // The autosave watcher must not flip it back to "unsaved" on the next tick.
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.saved).toBe(true);
  });

  it("markSaved clears the unsaved indicator without flipping back", async () => {
    const bootstrapped = { current: true };
    const { result } = renderHook(() => useAutosaveStatus(initialScene, null, bootstrapped));
    // Simulate an unsaved edit
    act(() => result.current.saveNow());
    await new Promise((r) => setTimeout(r, 10));
    act(() => result.current.markSaved());
    expect(result.current.saved).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.saved).toBe(true);
    expect(result.current.saveToast).toBeNull();
  });

  it("does not flag unsaved before bootstrap completes", async () => {
    const bootstrapped = { current: false };
    const { result, rerender } = renderHook(
      ({ scene }) => useAutosaveStatus(scene, null, bootstrapped),
      { initialProps: { scene: initialScene } }
    );
    expect(result.current.saved).toBe(true);
    await waitFor(() => expect(result.current.savedSceneRef.current).not.toBeNull());
  });
});
