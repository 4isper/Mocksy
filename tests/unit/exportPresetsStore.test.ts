import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_EXPORT_PRESETS, presetLabel, useExportPresetsStore } from "@/lib/state/exportPresetsStore";

describe("presetLabel", () => {
  it("formats scale-based presets", () => {
    expect(presetLabel("png", 2, null)).toBe("PNG 2×");
    expect(presetLabel("mp4", 4, null)).toBe("MP4 4×");
    expect(presetLabel("webpAnim", 1, null)).toBe("WebP 1×");
  });

  it("formats custom-size presets and ignores the scale", () => {
    expect(presetLabel("mp4", 4, { width: 1280, height: 720 })).toBe("MP4 1280×720");
    expect(presetLabel("zip", 2, { width: 800, height: 600 })).toBe("ZIP 800×600");
  });

  it("falls back to an uppercase label for unknown formats", () => {
    // @ts-expect-error exercising the fallback with a hostile value
    expect(presetLabel("mystery", 2, null)).toBe("MYSTERY 2×");
  });
});

describe("useExportPresetsStore", () => {
  beforeEach(() => {
    useExportPresetsStore.setState({ presets: [] });
    vi.restoreAllMocks();
  });

  it("saves presets newest-first with a derived label", () => {
    const { savePreset } = useExportPresetsStore.getState();
    savePreset("png", 2, null);
    savePreset("mp4", 1, { width: 1080, height: 1920 });
    const presets = useExportPresetsStore.getState().presets;
    expect(presets.map((p) => p.label)).toEqual(["MP4 1080×1920", "PNG 2×"]);
  });

  it("does not duplicate identical settings", () => {
    const { savePreset } = useExportPresetsStore.getState();
    savePreset("png", 2, null);
    savePreset("png", 2, null);
    expect(useExportPresetsStore.getState().presets).toHaveLength(1);
  });

  it("removes a preset by id", () => {
    const { savePreset } = useExportPresetsStore.getState();
    savePreset("png", 1, null);
    const [preset] = useExportPresetsStore.getState().presets;
    useExportPresetsStore.getState().removePreset(preset!.id);
    expect(useExportPresetsStore.getState().presets).toHaveLength(0);
  });

  it("caps the list at MAX_EXPORT_PRESETS dropping the oldest", () => {
    const { savePreset } = useExportPresetsStore.getState();
    for (let i = 0; i < MAX_EXPORT_PRESETS + 3; i++) {
      // Vary the size so every save is unique.
      savePreset("png", 1, { width: 100 + i, height: 200 });
    }
    const presets = useExportPresetsStore.getState().presets;
    expect(presets).toHaveLength(MAX_EXPORT_PRESETS);
    // Newest first: the last-saved width survives, the earliest three are gone.
    expect(presets[0]!.customSize).toEqual({ width: 100 + MAX_EXPORT_PRESETS + 2, height: 200 });
    expect(presets.at(-1)!.customSize).toEqual({ width: 103, height: 200 });
  });
});
