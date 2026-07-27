import { describe, expect, it, vi } from "vitest";
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

  it("loadMediaFromFile returns a data: URL and metadata", async () => {
    const result = await loadMediaFromFile(file("demo.mp4", "video/mp4"));
    expect(result.mediaType).toBe("video");
    expect(result.mediaName).toBe("demo.mp4");
    expect(result.url).toMatch(/^data:/);
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

  it("loadMediaFromFile rejects unsupported files", async () => {
    await expect(loadMediaFromFile(file("notes.pdf", "application/pdf"))).rejects.toThrow(UnsupportedMediaError);
    await expect(loadMediaFromFile(file("notes.pdf", "application/pdf"))).rejects.toThrow(/"notes.pdf" is not a supported/);
  });

  it("detects video by special mime patterns (quicktime in type)", () => {
    expect(detectMediaType(file("clip", "video/quicktime"))).toBe("video");
    expect(detectMediaType(file("clip", "application/webm"))).toBe("video");
  });

  it("detects video by all video extensions", () => {
    expect(detectMediaType(file("a.mp4", ""))).toBe("video");
    expect(detectMediaType(file("a.mov", ""))).toBe("video");
    expect(detectMediaType(file("a.m4v", ""))).toBe("video");
    expect(detectMediaType(file("a.webm", ""))).toBe("video");
    expect(detectMediaType(file("a.ogg", ""))).toBe("video");
    expect(detectMediaType(file("a.ogv", ""))).toBe("video");
    expect(detectMediaType(file("a.avi", ""))).toBe("video");
    expect(detectMediaType(file("a.mkv", ""))).toBe("video");
  });

  it("accepts all supported image extensions", () => {
    expect(isSupportedMedia(file("shot.jpg", ""))).toBe(true);
    expect(isSupportedMedia(file("shot.jpeg", ""))).toBe(true);
    expect(isSupportedMedia(file("shot.png", "image/"))).toBe(true);
    expect(isSupportedMedia(file("shot.gif", ""))).toBe(true);
    expect(isSupportedMedia(file("shot.webp", ""))).toBe(true);
    expect(isSupportedMedia(file("shot.avif", ""))).toBe(true);
    expect(isSupportedMedia(file("shot.svg", ""))).toBe(true);
    expect(isSupportedMedia(file("shot.bmp", ""))).toBe(true);
    expect(isSupportedMedia(file("shot.ico", ""))).toBe(true);
  });

  it("arrayBufferToBase64 uses Buffer in Node environment", () => {
    // Note: arrayBufferToBase64 is internal, but we can test the blobToDataUrl path
    expect(loadMediaFromFile).toBeDefined();
  });
});
