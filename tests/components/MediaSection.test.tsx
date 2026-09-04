// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaSection } from "@/components/editor/sections/MediaSection";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorScene";
import { useRecentMediaStore } from "@/lib/state/recentMediaStore";
import { loadMediaFromFile, loadMediaFromUrl, UnsupportedMediaError, UnsupportedMediaUrlError } from "@/lib/media/loadFile";
import type { MediaLayer } from "@/lib/types/editor";

vi.mock("@/lib/media/loadFile", () => ({
  loadMediaFromFile: vi.fn(),
  loadMediaFromUrl: vi.fn(),
  UnsupportedMediaError: class extends Error { name = "UnsupportedMediaError" },
  UnsupportedMediaUrlError: class extends Error { name = "UnsupportedMediaUrlError" },
}));

const mockLoadFile = vi.mocked(loadMediaFromFile);
const mockLoadUrl = vi.mocked(loadMediaFromUrl);

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

async function resetStore() {
  useEditorStore.setState({
    scene: { ...initialScene, layers: initialScene.layers.map((l) => ({ ...l })),
      frameInstances: [], annotations: [] },
    activeLayerId: initialScene.activeLayerId,
    selectedLayerIds: [],
    mediaUploadError: null,
    isMediaLoading: false,
    isRemovingBackground: false,
    mobileSheet: null,
  });
  useRecentMediaStore.setState({ entries: [] });
  window.localStorage.removeItem("mocksy-recent-media");
}

afterEach(async () => {
  cleanup();
  vi.clearAllMocks();
  await resetStore();
});

describe("MediaSection", () => {
  it("renders upload trigger and URL field", () => {
    render(<MediaSection />);
    expect(screen.getByText("editor.uploadMediaShort")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editor.recordScreen/ })).toBeInTheDocument();
    expect(screen.getByLabelText("editor.mediaByUrl")).toBeInTheDocument();
  });

  it("applies a single file to the active layer", async () => {
    mockLoadFile.mockResolvedValue({ url: "blob:one", mediaType: "image", mediaName: "one.png" });
    useEditorStore.setState({ scene: { ...initialScene, layers: [resetLayer("single")] }, activeLayerId: "single" });
    render(<MediaSection />);
    await userEvent.upload(fileInput(), new File(["x"], "one.png", { type: "image/png" }));
    const layer = useEditorStore.getState().scene.layers.find((l) => l.id === "single")!;
    expect(layer.mediaUrl).toBe("blob:one");
    expect(layer.mediaType).toBe("image");
    expect(layer.mediaName).toBe("one.png");
  });

  it("distributes multiple files across empty frame layers", async () => {
    mockLoadFile
      .mockResolvedValueOnce({ url: "blob:first", mediaType: "image", mediaName: "first.png" })
      .mockResolvedValueOnce({ url: "blob:second", mediaType: "image", mediaName: "second.png" });
    // Two empty frame layers, one non-frame layer with media already set.
    const scene = {
      ...initialScene,
      layers: [
        replaceLayerMedia(initialScene.layers[0]!, null, "none", null, "frameA"),
        replaceLayerMedia(initialScene.layers[0]!, null, "none", null, "frameB"),
        replaceLayerMedia(initialScene.layers[0]!, "blob:existing", "image", "existing.png", "other"),
      ],
      frameInstances: [
        { ...blankInstance(), layerId: "frameA" },
        { ...blankInstance(), layerId: "frameB" },
      ],
      activeLayerId: "frameA",
    };
    useEditorStore.setState({ scene });
    render(<MediaSection />);
    await userEvent.upload(fileInput(), [
      new File(["x"], "first.png", { type: "image/png" }),
      new File(["x"], "second.png", { type: "image/png" }),
    ]);
    const layers = useEditorStore.getState().scene.layers;
    expect(layers.find((l) => l.id === "frameA")!.mediaUrl).toBe("blob:first");
    expect(layers.find((l) => l.id === "frameB")!.mediaUrl).toBe("blob:second");
    expect(layers.find((l) => l.id === "other")!.mediaUrl).toBe("blob:existing");
  });

  it("shows the unsupported-media message on a single-file upload failure", async () => {
    mockLoadFile.mockRejectedValue(new UnsupportedMediaError("bad format"));
    render(<MediaSection />);
    await userEvent.upload(fileInput(), new File(["x"], "x.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("bad format");
  });

  it("shows a generic message when a file upload fails unexpectedly", async () => {
    mockLoadFile.mockRejectedValue(new Error("boom"));
    render(<MediaSection />);
    await userEvent.upload(fileInput(), new File(["x"], "x.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("editor.uploadError");
  });

  it("applies media by URL on button click", async () => {
    mockLoadUrl.mockResolvedValue({ url: "https://x/y.jpg", mediaType: "image", mediaName: "y.jpg" });
    render(<MediaSection />);
    const input = screen.getByLabelText("editor.mediaByUrl") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://x/y.jpg" } });
    fireEvent.click(screen.getByRole("button", { name: /editor.mediaByUrlButton/ }));
    await waitFor(() => expect(useEditorStore.getState().scene.layers[0]!.mediaUrl).toBe("https://x/y.jpg"));
    await waitFor(() => expect(screen.getByLabelText("editor.mediaByUrl")).toHaveValue(""));
  });

  it("submits the URL on Enter", async () => {
    mockLoadUrl.mockResolvedValue({ url: "https://x/z.jpg", mediaType: "image", mediaName: "z.jpg" });
    render(<MediaSection />);
    const input = screen.getByLabelText("editor.mediaByUrl") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://x/z.jpg" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(useEditorStore.getState().scene.layers[0]!.mediaUrl).toBe("https://x/z.jpg"));
  });

  it("does not submit an empty or whitespace URL", async () => {
    render(<MediaSection />);
    const input = screen.getByLabelText("editor.mediaByUrl") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockLoadUrl).not.toHaveBeenCalled();
  });

  it("surfaces an unsupported-URL error", async () => {
    mockLoadUrl.mockRejectedValue(new UnsupportedMediaUrlError("unsupported url"));
    render(<MediaSection />);
    const input = screen.getByLabelText("editor.mediaByUrl") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ftp://x" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent("unsupported url");
  });

  it("surfaces a generic URL error", async () => {
    mockLoadUrl.mockRejectedValue(new Error("boom"));
    render(<MediaSection />);
    const input = screen.getByLabelText("editor.mediaByUrl") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://x" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent("editor.uploadError");
  });

  it("clears media from the active layer", async () => {
    useEditorStore.setState({
      scene: { ...initialScene, layers: [resetLayer("single", { mediaUrl: "blob:x", mediaType: "image", mediaName: "x.png" })] },
      activeLayerId: "single",
    });
    render(<MediaSection />);
    fireEvent.click(screen.getByRole("button", { name: /editor.clearMedia/ }));
    const layer = useEditorStore.getState().scene.layers.find((l) => l.id === "single")!;
    expect(layer.mediaUrl).toBeNull();
    expect(layer.mediaType).toBe("none");
  });

  it("adds a text layer", async () => {
    render(<MediaSection />);
    fireEvent.click(screen.getByRole("button", { name: /editor.addTextLayer/ }));
    const layers = useEditorStore.getState().scene.layers;
    expect(layers.some((l) => l.kind === "text")).toBe(true);
  });

  it("applies a recent-media entry to the active layer, removes it on context menu and clears all", async () => {
    useRecentMediaStore.setState({
      entries: [
        { id: "rm-1", dataUrl: "data:image/png;base64,AAA", mediaName: "recent.png", mediaType: "image", usedAt: 1 },
        { id: "rm-2", dataUrl: "data:video/mp4;base64,BB", mediaName: null, mediaType: "video", usedAt: 2 },
      ],
    });
    render(<MediaSection />);
    expect(screen.getByTitle("recent.png")).toBeInTheDocument();
    expect(screen.getByText("▶")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("recent.png"));
    expect(useEditorStore.getState().scene.layers[0]!.mediaUrl).toBe("data:image/png;base64,AAA");
    expect(useEditorStore.getState().scene.layers[0]!.mediaName).toBe("recent.png");

    fireEvent.contextMenu(screen.getByTitle("recent.png"));
    expect(useRecentMediaStore.getState().entries.map((e) => e.id)).toEqual(["rm-2"]);

    fireEvent.click(screen.getByRole("button", { name: /editor.recentMediaClear/ }));
    expect(useRecentMediaStore.getState().entries).toEqual([]);
  });

  it("hides the recent grid when there are no entries", () => {
    render(<MediaSection />);
    expect(screen.queryByText("editor.recentMedia")).not.toBeInTheDocument();
  });
});

function resetLayer(id: string, overrides: Partial<MediaLayer> = {}): MediaLayer {
  const base = initialScene.layers[0]!;
  return { ...base, id, mediaUrl: null, mediaType: "none", mediaName: null, ...overrides } as MediaLayer;
}

function replaceLayerMedia(layer: MediaLayer, mediaUrl: string | null, mediaType: MediaLayer["mediaType"], mediaName: string | null, id: string): MediaLayer {
  return { ...layer, id, mediaUrl, mediaType, mediaName };
}

function blankInstance() {
  return {
    id: `fi-${Math.random()}`,
    frame: "iphone" as const,
    x: 0,
    y: 0,
    scale: 1,
    layerId: null,
  };
}