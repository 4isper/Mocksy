import { afterEach, describe, expect, it, vi } from "vitest";
import { loadExportAssets } from "@/lib/export/exportAssets";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene } from "@/lib/types/editor";

vi.mock("@/lib/render/canvasMedia", () => ({
  loadImage: vi.fn().mockResolvedValue(null as unknown as HTMLImageElement),
  loadVideoFrame: vi.fn().mockResolvedValue(null),
}));

import { loadImage } from "@/lib/render/canvasMedia";

function scene(overrides: Partial<EditorScene> = {}): EditorScene {
  return { ...initialScene, ...overrides };
}

afterEach(() => {
  vi.mocked(loadImage).mockReset();
  vi.mocked(loadImage).mockResolvedValue(null as unknown as HTMLImageElement);
});

describe("loadExportAssets", () => {
  it("returns all-null assets for a plain scene with no extras", async () => {
    const assets = await loadExportAssets(scene({ frame: "none" }));
    expect(assets).toEqual({ overlay: null, backgroundImage: null, watermarkImage: null });
    expect(loadImage).not.toHaveBeenCalled();
  });

  it("loads the overlay skin for overlay frames", async () => {
    const fakeImg = { src: "skin" } as unknown as HTMLImageElement;
    vi.mocked(loadImage).mockResolvedValue(fakeImg);
    const assets = await loadExportAssets(scene({ frame: "iphone15" }));
    expect(assets.overlay).toBe(fakeImg);
    expect(loadImage).toHaveBeenCalledWith(expect.stringContaining("devices"));
  });

  it("loads the background and watermark images when enabled", async () => {
    const bg = { src: "bg" } as unknown as HTMLImageElement;
    const wm = { src: "wm" } as unknown as HTMLImageElement;
    vi.mocked(loadImage).mockImplementation(async (src: string) => {
      if (src.includes("BG")) return bg as HTMLImageElement;
      if (src.includes("WM")) return wm as HTMLImageElement;
      return null as unknown as HTMLImageElement;
    });
    const assets = await loadExportAssets(
      scene({
        frame: "none",
        backgroundMode: "image",
        backgroundImageUrl: "data:image/png;base64,BG",
        watermarkEnabled: true,
        watermarkImageUrl: "data:image/png;base64,WM"
      })
    );
    expect(assets.backgroundImage).toBe(bg);
    expect(assets.watermarkImage).toBe(wm);
    expect(loadImage).toHaveBeenCalledWith("data:image/png;base64,BG");
    expect(loadImage).toHaveBeenCalledWith("data:image/png;base64,WM");
  });

  it("skips the watermark image when the watermark is disabled", async () => {
    const assets = await loadExportAssets(
      scene({ frame: "none", watermarkEnabled: false, watermarkImageUrl: "data:image/png;base64,WM" })
    );
    expect(assets.watermarkImage).toBeNull();
    expect(loadImage).not.toHaveBeenCalledWith("data:image/png;base64,WM");
  });

  it("treats a failed asset load as null rather than throwing", async () => {
    vi.mocked(loadImage).mockRejectedValueOnce(new Error("skin failed"));
    const assets = await loadExportAssets(scene({ frame: "iphone15" }));
    expect(assets.overlay).toBeNull();
  });
});
