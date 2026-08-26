// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FrameInstanceList } from "@/components/editor/FrameInstanceList";
import type { EditorScene } from "@/lib/types/editor";
import { initialScene } from "@/lib/state/editorStore";

function makeScene(): EditorScene {
  return {
    ...initialScene,
    layers: [
      {
        id: "l1",
        mediaUrl: "data:image/png;base64,AAAA",
        mediaType: "image",
        mediaName: "Shot 1",
        zoom: 1,
        mediaOffsetX: 0,
        mediaOffsetY: 0,
        animationPreset: "none",
        mediaFit: "cover",
        hidden: false,
        videoDuration: 0,
        videoTrimStart: 0,
        videoTrimEnd: 0,
        videoMuted: false,
        videoLoop: false,
        videoAutoplay: false,
        videoPosterTime: 0,
        videoQuality: "medium",
      },
      {
        id: "l2",
        mediaUrl: null,
        mediaType: "none",
        mediaName: null,
        zoom: 1,
        mediaOffsetX: 0,
        mediaOffsetY: 0,
        animationPreset: "none",
        mediaFit: "cover",
        hidden: false,
        videoDuration: 0,
        videoTrimStart: 0,
        videoTrimEnd: 0,
        videoMuted: false,
        videoLoop: false,
        videoAutoplay: false,
        videoPosterTime: 0,
        videoQuality: "medium",
      },
    ],
    frameInstances: [
      { id: "f1", frame: "iphone", x: 0.1, y: 0.2, scale: 1, layerId: "l1" },
      { id: "f2", frame: "desktop", x: 0.5, y: 0.5, scale: 1.5, layerId: null },
    ],
  };
}

function renderList(selectedFrameIds: string[] = []) {
  const selectFrameInstance = vi.fn();
  const selectFrameIds = vi.fn();
  const toggleFrameSelected = vi.fn();
  const setFrameInstances = vi.fn();
  const updateFrameInstance = vi.fn();
  const removeFrameInstance = vi.fn();
  const addFrameInstance = vi.fn();
  const setExpandedFrameId = vi.fn();
  const utils = render(
    <FrameInstanceList
      scene={makeScene()}
      expandedFrameId={null}
      setExpandedFrameId={setExpandedFrameId}
      selectFrameInstance={selectFrameInstance}
      selectFrameIds={selectFrameIds}
      toggleFrameSelected={toggleFrameSelected}
      selectedFrameIds={selectedFrameIds}
      setFrameInstances={setFrameInstances}
      updateFrameInstance={updateFrameInstance}
      removeFrameInstance={removeFrameInstance}
      addFrameInstance={addFrameInstance}
    />
  );
  return { selectFrameInstance, selectFrameIds, toggleFrameSelected, setFrameInstances, updateFrameInstance, removeFrameInstance, setExpandedFrameId, ...utils };
}

afterEach(() => {
  cleanup();
});

describe("FrameInstanceList", () => {
  it("always shows the Add frame button even without frame instances", () => {
    render(
      <FrameInstanceList
        scene={{ ...initialScene, frameInstances: [] }}
        expandedFrameId={null}
        setExpandedFrameId={vi.fn()}
        selectFrameInstance={vi.fn()}
        selectFrameIds={vi.fn()}
        toggleFrameSelected={vi.fn()}
        selectedFrameIds={[]}
        setFrameInstances={vi.fn()}
        updateFrameInstance={vi.fn()}
        removeFrameInstance={vi.fn()}
        addFrameInstance={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "editor.addFrame" })).toBeInTheDocument();
  });

  it("lists frame instances with device selects", () => {
    renderList();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "editor.moveUp" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "editor.removeFrame" })).toHaveLength(2);
  });

  it("shows a placeholder for layers without media", () => {
    renderList();
    expect(screen.getAllByText("—")).toHaveLength(1);
  });

  it("expands a frame and selects the instance", async () => {
    const { setExpandedFrameId, selectFrameInstance } = renderList();
    await userEvent.click(screen.getAllByRole("button", { name: "editor.expand" })[0]!);
    expect(setExpandedFrameId).toHaveBeenCalledWith("f1");
    expect(selectFrameInstance).toHaveBeenCalledWith("f1");
  });

  it("collapses an expanded frame and deselects", async () => {
    const { setExpandedFrameId, selectFrameInstance } = renderList();
    render(
      <FrameInstanceList
        scene={makeScene()}
        expandedFrameId="f1"
        setExpandedFrameId={setExpandedFrameId}
        selectFrameInstance={selectFrameInstance}
        selectFrameIds={vi.fn()}
        toggleFrameSelected={vi.fn()}
        selectedFrameIds={[]}
        setFrameInstances={vi.fn()}
        updateFrameInstance={vi.fn()}
        removeFrameInstance={vi.fn()}
        addFrameInstance={vi.fn()}
      />
    );
    await userEvent.click(screen.getAllByRole("button", { name: "editor.collapse" })[0]!);
    expect(setExpandedFrameId).toHaveBeenCalledWith(null);
    expect(selectFrameInstance).toHaveBeenCalledWith(null);
  });

  it("moves a frame up", async () => {
    const { setFrameInstances } = renderList();
    await userEvent.click(screen.getAllByRole("button", { name: "editor.moveUp" })[1]!);
    const instances = setFrameInstances.mock.calls[0]![0] as EditorScene["frameInstances"];
    expect(instances[0]!.id).toBe("f2");
    expect(instances[1]!.id).toBe("f1");
  });

  it("moves a frame down", async () => {
    const { setFrameInstances } = renderList();
    await userEvent.click(screen.getAllByRole("button", { name: "editor.moveDown" })[0]!);
    const instances = setFrameInstances.mock.calls[0]![0] as EditorScene["frameInstances"];
    expect(instances[0]!.id).toBe("f2");
    expect(instances[1]!.id).toBe("f1");
  });

  it("disables move up for the first frame and move down for the last", () => {
    renderList();
    expect(screen.getAllByRole("button", { name: "editor.moveUp" })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "editor.moveDown" })[1]).toBeDisabled();
  });

  it("updates the device frame", () => {
    const { updateFrameInstance } = renderList();
    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "macbook" } });
    expect(updateFrameInstance).toHaveBeenCalledWith("f1", { frame: "macbook" });
  });

  it("removes a frame instance", async () => {
    const { removeFrameInstance } = renderList();
    await userEvent.click(screen.getAllByRole("button", { name: "editor.removeFrame" })[0]!);
    expect(removeFrameInstance).toHaveBeenCalledWith("f1");
  });

  it("updates x, y and scale sliders when expanded", () => {
    const { updateFrameInstance } = renderList();
    render(
      <FrameInstanceList
        scene={makeScene()}
        expandedFrameId="f1"
        setExpandedFrameId={vi.fn()}
        selectFrameInstance={vi.fn()}
        selectFrameIds={vi.fn()}
        toggleFrameSelected={vi.fn()}
        selectedFrameIds={[]}
        setFrameInstances={vi.fn()}
        updateFrameInstance={updateFrameInstance}
        removeFrameInstance={vi.fn()}
        addFrameInstance={vi.fn()}
      />
    );
    fireEvent.change(screen.getByRole("slider", { name: "editor.frameX" }), { target: { value: "0.4" } });
    expect(updateFrameInstance).toHaveBeenCalledWith("f1", { x: 0.4 });
    fireEvent.change(screen.getByRole("slider", { name: "editor.frameY" }), { target: { value: "0.6" } });
    expect(updateFrameInstance).toHaveBeenCalledWith("f1", { y: 0.6 });
    fireEvent.change(screen.getByRole("slider", { name: "editor.frameScale" }), { target: { value: "2" } });
    expect(updateFrameInstance).toHaveBeenCalledWith("f1", { scale: 2 });
  });

  it("shows percentage values next to sliders", () => {
    render(
      <FrameInstanceList
        scene={makeScene()}
        expandedFrameId="f1"
        setExpandedFrameId={vi.fn()}
        selectFrameInstance={vi.fn()}
        selectFrameIds={vi.fn()}
        toggleFrameSelected={vi.fn()}
        selectedFrameIds={[]}
        setFrameInstances={vi.fn()}
        updateFrameInstance={vi.fn()}
        removeFrameInstance={vi.fn()}
        addFrameInstance={vi.fn()}
      />
    );
    expect(screen.getByText("10%")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("updates the layer for a frame instance", () => {
    const { updateFrameInstance } = renderList();
    render(
      <FrameInstanceList
        scene={makeScene()}
        expandedFrameId="f2"
        setExpandedFrameId={vi.fn()}
        selectFrameInstance={vi.fn()}
        selectFrameIds={vi.fn()}
        toggleFrameSelected={vi.fn()}
        selectedFrameIds={[]}
        setFrameInstances={vi.fn()}
        updateFrameInstance={updateFrameInstance}
        removeFrameInstance={vi.fn()}
        addFrameInstance={vi.fn()}
      />
    );
    fireEvent.change(screen.getByRole("combobox", { name: "editor.frameLayer" }), { target: { value: "l2" } });
    expect(updateFrameInstance).toHaveBeenCalledWith("f2", { layerId: "l2" });
  });
});
