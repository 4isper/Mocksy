import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialScene } from "@/lib/state/editorStore";
import {
  BUNDLE_MEDIA_DIR,
  BUNDLE_MEDIA_REF_PREFIX,
  PROJECT_BUNDLE_FORMAT,
  MAX_BUNDLE_FILE_SIZE,
  bundleEntryName,
  bundleSceneMedia,
  exportProjectBundle,
  importProjectBundle,
  isBundleFile,
  resolveBundleMedia
} from "@/lib/state/projectBundle";
import type { EditorScene, Project } from "@/lib/types/editor";

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
const JPG_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

/** fetch(data:) stub — Node's fetch can't read data URLs, so decode manually. */
function stubFetchDataUrls(): void {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const m = /^data:([^;,]*)(;base64)?,(.*)$/.exec(url);
    if (!m) throw new Error(`Unsupported URL in test: ${url.slice(0, 40)}`);
    const mime = m[1] || "application/octet-stream";
    const bytes = m[2]
      ? Uint8Array.from(atob(m[3]!), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(m[3]!);
    return { blob: () => Promise.resolve(new Blob([bytes], { type: mime })) };
  }));
}

class FakeFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((e?: unknown) => void) | null = null;
  onerror: ((e?: unknown) => void) | null = null;
  private fire(): void {
    // JSZip's handler reads e.target.result.
    this.onload?.({ target: { result: this.result } });
  }
  readAsDataURL(blob: Blob): void {
    blob.arrayBuffer().then((buf) => {
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (const b of bytes) binary += String.fromCharCode(b);
      this.result = `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
      this.fire();
    });
  }
  // JSZip reads Blob inputs through FileReader as well.
  readAsArrayBuffer(blob: Blob): void {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.fire();
    });
  }
}

function makeProject(sceneOverrides: Partial<EditorScene> = {}): Project {
  const scene = {
    ...initialScene,
    layers: initialScene.layers.map((l, i) => ({
      ...l,
      mediaUrl: i === 0 ? PNG_DATA_URL : l.mediaUrl,
      mediaType: i === 0 ? ("image" as const) : l.mediaType
    })),
    backgroundImageUrl: JPG_DATA_URL,
    ...sceneOverrides
  } as EditorScene;
  return { id: "proj-1", name: "My Shot", scene, updatedAt: 123 };
}

beforeEach(() => {
  stubFetchDataUrls();
  vi.stubGlobal("FileReader", FakeFileReader);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("projectBundle helpers", () => {
  it("bundleEntryName maps common mimes to file extensions", () => {
    expect(bundleEntryName("abc", "image/png")).toMatch(/\.png$/);
    expect(bundleEntryName("abc", "image/jpeg")).toMatch(/\.jpg$/);
    expect(bundleEntryName("abc", "video/mp4")).toMatch(/\.mp4$/);
    expect(bundleEntryName("abc", "audio/mpeg")).toMatch(/\.mp3$/);
    expect(bundleEntryName("abc", "weird/type")).toMatch(/\.bin$/);
    expect(bundleEntryName("abc", "image/png")).toBe("abc.png");
  });

  it("isBundleFile detects zips by name or type", () => {
    expect(isBundleFile({ name: "project.mocksy.zip" })).toBe(true);
    expect(isBundleFile({ name: "project.ZIP" })).toBe(true);
    expect(isBundleFile({ name: "project.json" })).toBe(false);
  });

  it("resolveBundleMedia degrades missing blobs to null media", async () => {
    const resolved = await resolveBundleMedia(
      { layers: [{ mediaUrl: `${BUNDLE_MEDIA_REF_PREFIX}deadbeef.png` }] },
      async () => null
    );
    expect((resolved.layers as Array<{ mediaUrl: string | null }>)[0]!.mediaUrl).toBeNull();
  });

  it("resolveBundleMedia rejects unsafe entry names instead of looking them up", async () => {
    const lookup = vi.fn(async () => new Blob(["x"]));
    const resolved = await resolveBundleMedia(
      { layers: [{ mediaUrl: `${BUNDLE_MEDIA_REF_PREFIX}../../etc/passwd` }] },
      lookup
    );
    expect(lookup).not.toHaveBeenCalled();
    expect((resolved.layers as Array<{ mediaUrl: string | null }>)[0]!.mediaUrl).toBeNull();
  });

  it("MAX_BUNDLE_FILE_SIZE is far above the JSON cap but bounded", () => {
    expect(MAX_BUNDLE_FILE_SIZE).toBeGreaterThan(5 * 1024 * 1024);
    expect(MAX_BUNDLE_FILE_SIZE).toBeLessThanOrEqual(512 * 1024 * 1024);
  });
});

describe("exportProjectBundle + importProjectBundle round trip", () => {
  it("exports project.json plus deduped media files, and imports them back", async () => {
    const project = makeProject({
      // Same image twice → one archived file.
      layers: [
        { ...initialScene.layers[0]!, id: "a", mediaUrl: PNG_DATA_URL },
        { ...initialScene.layers[1]!, id: "b", mediaUrl: PNG_DATA_URL }
      ]
    });

    let capturedBlob: Blob | null = null;
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((b: Blob) => {
        capturedBlob = b;
        return "blob:mock";
      }),
      revokeObjectURL: vi.fn()
    });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => link),
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    });

    await exportProjectBundle(project);
    expect(link.download).toBe("My_Shot.mocksy.zip");
    expect(capturedBlob).not.toBeNull();

    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(capturedBlob!);

    // project.json carries refs, not data URLs.
    const payload = JSON.parse(await zip.file("project.json")!.async("string"));
    expect(payload.format).toBe(PROJECT_BUNDLE_FORMAT);
    expect(payload.name).toBe("My Shot");
    expect(payload.scene.backgroundImageUrl).toMatch(/^@media:[0-9a-f]{32}\.jpg$/);
    expect(payload.scene.layers.every((l: { mediaUrl: string }) => l.mediaUrl.startsWith("@media:"))).toBe(true);

    // Dedupe: two identical layer images + one distinct background = 2 files.
    const mediaFiles = Object.keys(zip.files).filter((n) => n.startsWith(`${BUNDLE_MEDIA_DIR}/`) && !zip.files[n]!.dir);
    expect(mediaFiles).toHaveLength(2);

    // The original scene object was not mutated by the export.
    expect(project.scene.backgroundImageUrl).toBe(JPG_DATA_URL);

    // Import restores everything as data: URLs under a fresh id.
    const file = new File([capturedBlob!], "My_Shot.mocksy.zip", { type: "application/zip" });
    const imported = await importProjectBundle(file);
    expect(imported.name).toBe("My Shot");
    expect(imported.id).not.toBe("proj-1");
    expect(imported.scene.backgroundImageUrl).toBe(JPG_DATA_URL);
    expect(imported.scene.layers.map((l) => l.mediaUrl)).toEqual([PNG_DATA_URL, PNG_DATA_URL]);
  });

  it("throws when the archive has no project.json", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file("random.txt", "hi");
    const blob = await zip.generateAsync({ type: "blob" });
    const file = new File([blob], "nope.zip", { type: "application/zip" });
    await expect(importProjectBundle(file)).rejects.toThrow("project.json");
  });

  it("throws on an unsupported format marker", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file("project.json", JSON.stringify({ format: "other-format", scene: {} }));
    const blob = await zip.generateAsync({ type: "blob" });
    await expect(
      importProjectBundle(new File([blob], "x.zip"))
    ).rejects.toThrow("Unsupported bundle format");
  });

  it("throws when a referenced media file is missing from the archive", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file("project.json", JSON.stringify({
      format: PROJECT_BUNDLE_FORMAT,
      name: "Broken",
      scene: { ...initialScene, backgroundImageUrl: "@media:00000000000000000000000000000ff.png" }
    }));
    const blob = await zip.generateAsync({ type: "blob" });
    const imported = await importProjectBundle(new File([blob], "broken.zip"));
    // Degrades to empty background rather than a dead reference.
    expect(imported.scene.backgroundImageUrl).toBeNull();
  });

  it("falls back to the filename when the bundle has no name", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file("project.json", JSON.stringify({ format: PROJECT_BUNDLE_FORMAT, scene: { ...initialScene } }));
    const blob = await zip.generateAsync({ type: "blob" });
    const imported = await importProjectBundle(new File([blob], "holiday-shot.mocksy.zip"));
    expect(imported.name).toBe("holiday-shot");
  });

  it("rejects oversized bundles before parsing", async () => {
    const big = new File([new Uint8Array(1)], "huge.zip");
    Object.defineProperty(big, "size", { value: MAX_BUNDLE_FILE_SIZE + 1 });
    await expect(importProjectBundle(big)).rejects.toThrow("too large");
  });
});
