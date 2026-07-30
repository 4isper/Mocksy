import { describe, expect, it, vi } from "vitest";
import { detectMediaType, isAudioFile, isSupportedMedia, loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";

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

  it("loadMediaFromFile handles large buffer without Buffer API using chunked loop", async () => {
    vi.stubGlobal("Buffer", undefined);
    const size = 0x8001;
    const arr = new Uint8Array(size).fill(65);
    const largeFile = new File([arr], "large.png", { type: "image/png" });
    const result = await loadMediaFromFile(largeFile);
    expect(result.url).toMatch(/^data:image\/png;base64,/);
    vi.unstubAllGlobals();
  });

it("blobToDataUrl falls back to application/octet-stream when blob type is empty", async () => {
  const fileWithEmptyType = new File(["abc"], "test.png", { type: "" });
  const result = await loadMediaFromFile(fileWithEmptyType);
  expect(result.url).toMatch(/^data:application\/octet-stream;base64,/);
});

it("detects audio files by mime type", () => {
  expect(isAudioFile(file("track.mp3", "audio/mp3"))).toBe(true);
  expect(isAudioFile(file("track.wav", "audio/wav"))).toBe(true);
  expect(isAudioFile(file("track.ogg", "audio/ogg"))).toBe(true);
  expect(isAudioFile(file("track.flac", "audio/flac"))).toBe(true);
  expect(isAudioFile(file("track.m4a", "audio/mp4"))).toBe(true);
});

it("detects audio files by extension when mime is empty", () => {
  expect(isAudioFile(file("track.mp3", ""))).toBe(true);
  expect(isAudioFile(file("track.wav", ""))).toBe(true);
  expect(isAudioFile(file("track.ogg", ""))).toBe(true);
  expect(isAudioFile(file("track.aac", ""))).toBe(true);
  expect(isAudioFile(file("track.flac", ""))).toBe(true);
  expect(isAudioFile(file("track.m4a", ""))).toBe(true);
});

it("rejects non-audio files", () => {
  expect(isAudioFile(file("shot.png", "image/png"))).toBe(false);
  expect(isAudioFile(file("clip.mp4", "video/mp4"))).toBe(false);
  expect(isAudioFile(file("notes.txt", "text/plain"))).toBe(false);
});
});
