import { describe, expect, it } from "vitest";
import { detectMediaType, isSupportedMedia, loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";

const file = (name: string, type: string): File =>
  new File([new Uint8Array([1, 2, 3])], name, { type });

describe("loadFile", () => {
  it("detects video by mime type", () => {
    expect(detectMediaType(file("clip.mp4", "video/mp4"))).toBe("video");
    expect(detectMediaType(file("clip.webm", "video/webm"))).toBe("video");
  });

  it("detects video by extension when mime is missing", () => {
    expect(detectMediaType(file("clip.mov", ""))).toBe("video");
    expect(detectMediaType(file("clip.mkv", ""))).toBe("video");
  });

  it("detects image by default", () => {
    expect(detectMediaType(file("shot.png", "image/png"))).toBe("image");
    expect(detectMediaType(file("notes.txt", "text/plain"))).toBe("image");
  });

  it("loadMediaFromFile returns an object URL and metadata", () => {
    const result = loadMediaFromFile(file("demo.mp4", "video/mp4"));
    expect(result.mediaType).toBe("video");
    expect(result.mediaName).toBe("demo.mp4");
    expect(result.url).toMatch(/^blob:/);
  });

  it("accepts common image and video formats", () => {
    expect(isSupportedMedia(file("shot.png", "image/png"))).toBe(true);
    expect(isSupportedMedia(file("shot.webp", ""))).toBe(true);
    expect(isSupportedMedia(file("clip.mp4", "video/mp4"))).toBe(true);
    expect(isSupportedMedia(file("clip.mov", ""))).toBe(true);
  });

  it("rejects unsupported document formats", () => {
    expect(isSupportedMedia(file("notes.pdf", "application/pdf"))).toBe(false);
    expect(isSupportedMedia(file("data.csv", "text/csv"))).toBe(false);
  });

  it("loadMediaFromFile throws UnsupportedMediaError on bad files", () => {
    expect(() => loadMediaFromFile(file("notes.pdf", "application/pdf"))).toThrow(UnsupportedMediaError);
    expect(() => loadMediaFromFile(file("notes.pdf", "application/pdf"))).toThrow(/"notes.pdf" is not a supported/);
  });
});
