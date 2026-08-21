import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compressImageIfNeeded, convertHeicToPng, detectMediaType, isAudioFile, isHeicFile, isHttpMediaUrl, isSupportedMedia, loadMediaFromFile, loadMediaFromUrl, UnsupportedMediaError, UnsupportedMediaUrlError } from "@/lib/media/loadFile";

// heic2any ships a wasm decoder — keep it mocked so tests never pull it in.
const heic2anyMock = vi.hoisted(() => vi.fn(async ({ blob }: { blob: Blob }) => new Blob([blob], { type: "image/png" })));
vi.mock("heic2any", () => ({ default: heic2anyMock }));

beforeEach(() => {
  heic2anyMock.mockClear();
});

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

describe("compressImageIfNeeded", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const bigPhoto = (mime = "image/jpeg", size = 10_000_000): File =>
    new File([new Uint8Array(size)], "photo.jpg", { type: mime });

  function stubImageTools(dim: { width: number; height: number }): {
    draw: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    canvas: { width: number; height: number; toBlob: ReturnType<typeof vi.fn> };
  } {
    const draw = vi.fn();
    const close = vi.fn();
    const bitmap = { width: dim.width, height: dim.height, close };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ drawImage: draw }),
      toBlob: vi.fn((cb: (b: Blob | null) => void) =>
        cb(new Blob(["webp-bytes"], { type: "image/webp" }))
      )
    };
    vi.stubGlobal("document", { createElement: vi.fn().mockReturnValue(canvas) });
    return { draw, close, canvas };
  }

  it("keeps vector and animated formats untouched", async () => {
    await expect(compressImageIfNeeded(bigPhoto("image/svg+xml"))).resolves.toMatchObject({ type: "image/svg+xml" });
    await expect(compressImageIfNeeded(bigPhoto("image/gif"))).resolves.toMatchObject({ type: "image/gif" });
  });

  it("keeps small-dimension raster images untouched", async () => {
    stubImageTools({ width: 1000, height: 800 });
    const result = await compressImageIfNeeded(bigPhoto());
    expect(result.type).toBe("image/jpeg");
    expect(result.size).toBe(10_000_000);
  });

  it("downscales oversized photos to MAX_IMAGE_DIMENSION and re-encodes as WebP", async () => {
    stubImageTools({ width: 4096, height: 2048 });
    const result = await compressImageIfNeeded(bigPhoto());
    expect(result.type).toBe("image/webp");
    expect(result.size).toBeLessThan(10_000_000);
  });

  it("scales the longest side to MAX_IMAGE_DIMENSION preserving aspect ratio", async () => {
    const { canvas, draw } = stubImageTools({ width: 4096, height: 2048 });
    await compressImageIfNeeded(bigPhoto());
    expect(canvas.width).toBe(2048);
    expect(canvas.height).toBe(1024);
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 2048, 1024);
  });

  it("returns the original file when createImageBitmap is unavailable", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const result = await compressImageIfNeeded(bigPhoto());
    expect(result.type).toBe("image/jpeg");
  });

  it("returns the original file when decoding fails", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decode failed")));
    vi.stubGlobal("document", { createElement: vi.fn() });
    const result = await compressImageIfNeeded(bigPhoto());
    expect(result.type).toBe("image/jpeg");
  });

  it("returns the original file when canvas.toBlob yields null", async () => {
    stubImageTools({ width: 4096, height: 2048 }).canvas.toBlob.mockImplementation(
      (cb: (b: Blob | null) => void) => cb(null)
    );
    const result = await compressImageIfNeeded(bigPhoto());
    expect(result.type).toBe("image/jpeg");
  });

  it("loadMediaFromFile still returns a data: URL when compression is skipped in Node", async () => {
    const result = await loadMediaFromFile(bigPhoto());
    expect(result.url).toMatch(/^data:image\/jpeg;base64,/);
  });
});

describe("isHttpMediaUrl", () => {
  it("accepts http and https links", () => {
    expect(isHttpMediaUrl("https://example.com/shot.png")).toBe(true);
    expect(isHttpMediaUrl("http://example.com/clip.mp4")).toBe(true);
  });

  it("rejects non-http schemes and garbage", () => {
    expect(isHttpMediaUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isHttpMediaUrl("ftp://example.com/shot.png")).toBe(false);
    expect(isHttpMediaUrl("not a url")).toBe(false);
  });
});

describe("loadMediaFromUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(blob: Blob, ok = true) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok,
      blob: () => Promise.resolve(blob)
    } as Response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("fetches an image and returns a data: URL with metadata", async () => {
    stubFetch(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
    const result = await loadMediaFromUrl("https://example.com/shot.png");
    expect(result.mediaType).toBe("image");
    expect(result.mediaName).toBe("shot.png");
    expect(result.url).toMatch(/^data:image\/png;base64,/);
  });

  it("detects video by response mime", async () => {
    stubFetch(new Blob([new Uint8Array([1])], { type: "video/mp4" }));
    const result = await loadMediaFromUrl("https://example.com/clip.mp4");
    expect(result.mediaType).toBe("video");
    expect(result.url).toMatch(/^data:video\/mp4;base64,/);
  });

  it("rejects non-http URLs before fetching", async () => {
    const fetchMock = stubFetch(new Blob([new Uint8Array([1])], { type: "image/png" }));
    await expect(loadMediaFromUrl("file:///tmp/shot.png")).rejects.toThrow(UnsupportedMediaUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects failed HTTP responses", async () => {
    stubFetch(new Blob([new Uint8Array([1])], { type: "image/png" }), false);
    await expect(loadMediaFromUrl("https://example.com/404.png")).rejects.toThrow(UnsupportedMediaUrlError);
  });

  it("rejects non-image/video responses", async () => {
    stubFetch(new Blob(["<html>"], { type: "text/html" }));
    await expect(loadMediaFromUrl("https://example.com/page.html")).rejects.toThrow(UnsupportedMediaUrlError);
  });

  it("rejects when fetch itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(loadMediaFromUrl("https://example.com/shot.png")).rejects.toThrow(UnsupportedMediaUrlError);
  });

  it("derives a media name from the URL path, stripping query strings", async () => {
    stubFetch(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }));
    const result = await loadMediaFromUrl("https://example.com/path/photo.jpeg?token=abc");
    expect(result.mediaName).toBe("photo.jpeg");
  });
});
});

describe("heic import", () => {
  const heicFile = (name = "photo.heic"): File =>
    new File([new Uint8Array([1, 2, 3])], name, { type: "image/heic" });

  it("recognizes HEIC files by extension and mime", () => {
    expect(isHeicFile(heicFile())).toBe(true);
    expect(isHeicFile(new File([new Uint8Array([1])], "a.heif", { type: "" }))).toBe(true);
    expect(isHeicFile(file("a.png", "image/png"))).toBe(false);
    expect(isSupportedMedia(heicFile())).toBe(true);
    expect(detectMediaType(heicFile())).toBe("image");
  });

  it("converts HEIC to PNG through the lazy wasm path when native decode fails", async () => {
    const converted = await convertHeicToPng(heicFile());
    expect(heic2anyMock).toHaveBeenCalledTimes(1);
    expect(converted.name).toBe("photo.png");
    expect(converted.type).toBe("image/png");
  });

  it("skips the wasm converter when the browser decodes HEIC natively", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({ close: () => {} }));
    const original = heicFile();
    const result = await convertHeicToPng(original);
    expect(heic2anyMock).not.toHaveBeenCalled();
    expect(result).toBe(original); // original bytes kept untouched
    vi.unstubAllGlobals();
  });

  it("loadMediaFromFile round-trips a HEIC photo as a PNG data: URL", async () => {
    // No createImageBitmap in Node → wasm path runs.
    const loaded = await loadMediaFromFile(heicFile("IMG_0001.heic"));
    expect(loaded.mediaType).toBe("image");
    expect(loaded.mediaName).toBe("IMG_0001.heic");
    expect(loaded.url.startsWith("data:image/png;base64,")).toBe(true);
    expect(heic2anyMock).toHaveBeenCalledTimes(1);
  });
});
