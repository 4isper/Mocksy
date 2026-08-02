// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { act, useEffect } from "react";
import { useEditorExport, type EditorExportApi } from "@/lib/hooks/useEditorExport";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene, ExportSize } from "@/lib/types/editor";

const mockImage = vi.hoisted(() => ({
  exportImage: vi.fn(),
  copyPngToClipboard: vi.fn<(
    scene: EditorScene,
    containerId: string,
    onError?: (m: string) => void,
    onStatus?: (m: string) => void
  ) => Promise<void>>(),
  exportWebp: vi.fn(),
}));
const mockSvg = vi.hoisted(() => ({ exportSvg: vi.fn(() => Promise.resolve()) }));
const mockHtml = vi.hoisted(() => ({ exportHtml: vi.fn(() => Promise.resolve()) }));
const mockVideo = vi.hoisted(() => ({
  exportVideo: vi.fn(() => Promise.resolve()),
  exportWebm: vi.fn(() => Promise.resolve()),
  exportWebpAnim: vi.fn(() => Promise.resolve()),
  exportGif: vi.fn(() => Promise.resolve()),
}));
const mockShare = vi.hoisted(() => {
  class ShareUrlTooLarge extends Error {}
  return { sceneToShareUrl: vi.fn(), ShareUrlTooLarge };
});

vi.mock("@/lib/export/exportImage", () => mockImage);
vi.mock("@/lib/export/exportSvg", () => mockSvg);
vi.mock("@/lib/export/exportHtml", () => mockHtml);
vi.mock("@/lib/export/exportVideo", () => mockVideo);
vi.mock("@/lib/state/shareState", () => mockShare);

let api: EditorExportApi;
let closeDialog: () => void;

function Harness({ scene, scale, size }: { scene: EditorScene; scale: number; size: ExportSize | null }) {
  const result = useEditorExport(scene, scale, size, closeDialog);
  useEffect(() => {
    api = result;
  }, [result]);
  return <div />;
}

function renderHook(scene = initialScene, scale = 2, size: ExportSize | null = null) {
  closeDialog = vi.fn();
  render(<Harness scene={scene} scale={scale} size={size} />);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useEditorExport", () => {
  it("exports PNG via exportImage with scale and custom size", async () => {
    const size = { width: 1000, height: 800 };
    renderHook(initialScene, 4, size);
    await act(async () => {
      api.handleExportPng();
    });
    expect(mockImage.exportImage).toHaveBeenCalledWith(initialScene, "preview-canvas", "mocksy-export", expect.any(Function), 4, size);
  });

  it("copies PNG to clipboard and surfaces the transient copy status", async () => {
    mockImage.copyPngToClipboard.mockImplementation(
      async (_s: EditorScene, _id: string, _onError?: (m: string) => void, onStatus?: (m: string) => void) => {
        onStatus?.("Copied PNG to clipboard");
      }
    );
    renderHook();
    await act(async () => {
      await api.handleCopyPng();
    });
    expect(mockImage.copyPngToClipboard).toHaveBeenCalledTimes(1);
    expect(api.copyStatus).toBe("Copied PNG to clipboard");
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(api.copyStatus).toBeNull();
  });

  it("exports WebP and closes the dialog via handleExport", async () => {
    renderHook();
    await act(async () => {
      api.handleExport("webp");
    });
    expect(mockImage.exportWebp).toHaveBeenCalledTimes(1);
    expect(closeDialog).toHaveBeenCalledTimes(1);
  });

  it("exports SVG via the lazy module", async () => {
    renderHook();
    await act(async () => {
      await api.handleExportSvg();
    });
    expect(mockSvg.exportSvg).toHaveBeenCalledWith(initialScene, "preview-canvas", "mocksy-export", expect.any(Function));
  });

  it("exports HTML via the lazy module", async () => {
    renderHook();
    await act(async () => {
      await api.handleExportHtml();
    });
    expect(mockHtml.exportHtml).toHaveBeenCalledTimes(1);
  });

  it("exports MP4 and shows video status until cleared", async () => {
    renderHook();
    await act(async () => {
      await api.handleExportMp4();
    });
    expect(mockVideo.exportVideo).toHaveBeenCalledTimes(1);
    expect(api.isExporting).toBe(true);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(api.videoExportStatus).toBeNull();
    expect(api.isExporting).toBe(false);
  });

  it("exports WebM, animated WebP and GIF", async () => {
    renderHook();
    await act(async () => {
      await api.handleExportWebm();
    });
    expect(mockVideo.exportWebm).toHaveBeenCalledTimes(1);
    await act(async () => {
      await api.handleExportWebpAnim();
    });
    expect(mockVideo.exportWebpAnim).toHaveBeenCalledTimes(1);
    await act(async () => {
      await api.handleExportGif();
    });
    expect(mockVideo.exportGif).toHaveBeenCalledTimes(1);
    expect(api.gifExportStatus).not.toBeNull();
  });

  it("closes the dialog when copying from the dialog", async () => {
    renderHook();
    await act(async () => {
      await api.handleCopyFromDialog();
    });
    expect(closeDialog).toHaveBeenCalledTimes(1);
    expect(mockImage.copyPngToClipboard).toHaveBeenCalledTimes(1);
  });

  it("copies the share URL to the clipboard", async () => {
    mockShare.sceneToShareUrl.mockReturnValue("https://mocksy.test/s/abc");
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderHook();
    await act(async () => {
      await api.copyShareUrl();
    });
    expect(writeText).toHaveBeenCalledWith("https://mocksy.test/s/abc");
    expect(api.exportError).toBeNull();
  });

  it("reports an error when the share URL is too large", async () => {
    mockShare.sceneToShareUrl.mockImplementation(() => {
      throw new mockShare.ShareUrlTooLarge("too big");
    });
    renderHook();
    await act(async () => {
      await api.copyShareUrl();
    });
    expect(api.exportError).toBe("errors.shareUrlTooLarge");
  });
});
