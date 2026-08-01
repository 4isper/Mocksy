import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEmbeddedFontCss, collectFontStacks, fontAssetToDataUrl, primaryFontFamily } from "@/lib/export/fontEmbed";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene } from "@/lib/types/editor";

const FONT_BYTES = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 1, 2, 3, 4]).buffer;

function sceneWith(overrides: Partial<EditorScene> = {}): EditorScene {
  return { ...initialScene, ...overrides };
}

function stubFetch(ok = true): ReturnType<typeof vi.fn> {
  const mock = vi.fn(async () => ({
    ok,
    arrayBuffer: async () => FONT_BYTES
  }));
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("primaryFontFamily", () => {
  it("extracts the first family from a stack", () => {
    expect(primaryFontFamily("Inter, system-ui, sans-serif")).toBe("Inter");
    expect(primaryFontFamily("  Roboto , sans-serif")).toBe("Roboto");
    expect(primaryFontFamily("'Courier New', monospace")).toBe("Courier New");
    expect(primaryFontFamily('"Times New Roman", serif')).toBe("Times New Roman");
  });

  it("handles empty or malformed stacks", () => {
    expect(primaryFontFamily("")).toBe("");
    expect(primaryFontFamily("  , serif")).toBe("");
  });
});

describe("collectFontStacks", () => {
  it("collects stacks from text annotations and the watermark", () => {
    const scene = sceneWith({
      watermarkEnabled: true,
      watermarkText: "Mocksy",
      annotations: [
        { id: "a1", type: "text", x: 0, y: 0, w: 0.1, h: 0, text: "Hi", color: "#fff", strokeWidth: 0, fontSize: 20, fontFamily: "Roboto, sans-serif" },
        { id: "a2", type: "text", x: 0, y: 0, w: 0.1, h: 0, text: "Yo", color: "#fff", strokeWidth: 0, fontSize: 20, fontFamily: "Arial, Helvetica, sans-serif" },
        { id: "a3", type: "rect", x: 0, y: 0, w: 0.1, h: 0.1, text: "", color: "#fff", strokeWidth: 1, fontSize: 0 }
      ]
    });
    expect(collectFontStacks(scene)).toEqual([
      "Roboto, sans-serif",
      "Arial, Helvetica, sans-serif",
      "Inter, system-ui, sans-serif"
    ]);
  });

  it("omits the watermark stack when disabled or empty", () => {
    const scene = sceneWith({ watermarkEnabled: true, watermarkText: "" });
    expect(collectFontStacks(scene)).toEqual([]);
    expect(collectFontStacks(sceneWith({ watermarkEnabled: false, watermarkText: "Mocksy" }))).toEqual([]);
  });
});

describe("fontAssetToDataUrl", () => {
  it("re-encodes a fetched woff2 as a data: URL", async () => {
    stubFetch();
    const href = await fontAssetToDataUrl("/fonts/inter-latin.woff2");
    const expected = `data:font/woff2;base64,${Buffer.from(FONT_BYTES).toString("base64")}`;
    expect(href).toBe(expected);
  });

  it("returns null when the fetch fails", async () => {
    stubFetch(false);
    expect(await fontAssetToDataUrl("/fonts/missing.woff2")).toBeNull();
  });

  it("returns null when the request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    expect(await fontAssetToDataUrl("/fonts/inter-latin.woff2")).toBeNull();
  });
});

describe("buildEmbeddedFontCss", () => {
  it("emits one @font-face per bundled subset for used families only", async () => {
    stubFetch();
    const css = await buildEmbeddedFontCss(["Roboto, sans-serif", "'Courier New', monospace"]);
    const blocks = css.split("@font-face").filter(Boolean);
    expect(blocks).toHaveLength(4);
    expect(css).toContain('font-family: "Roboto"');
    expect(css).toContain("font-weight: 400 700");
    expect(css).toContain("format(\"woff2\")");
    expect(css).toContain("unicode-range: U+0000-00FF");
    expect(css).toContain("data:font/woff2;base64,");
    expect(css).not.toContain("Courier");
    expect(css).not.toContain("Inter");
  });

  it("returns empty CSS for unknown or empty stacks", async () => {
    stubFetch();
    expect(await buildEmbeddedFontCss([])).toBe("");
    expect(await buildEmbeddedFontCss(["Arial, Helvetica, sans-serif"])).toBe("");
  });

  it("fails gracefully when fonts cannot be fetched", async () => {
    stubFetch(false);
    expect(await buildEmbeddedFontCss(["Inter, system-ui, sans-serif"])).toBe("");
  });
});
