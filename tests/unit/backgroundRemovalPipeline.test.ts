import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({ pipelineMock: vi.fn() }));

// Intercept the lazy transformers.js import so the wasm/onnx runtime never
// actually loads in the test environment.
vi.mock("@huggingface/transformers", () => ({
  pipeline: hoisted.pipelineMock,
  env: {}
}));

type Remover = (image: string) => Promise<{ toBlob: (type?: string, quality?: number) => Promise<Blob> }>;

function makeRemover(): Remover {
  return async () => ({ toBlob: async () => new Blob(["x"], { type: "image/png" }) });
}

function makeFileReader(): typeof FileReader {
  return class {
    result = "data:image/png;base64,FAKE";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL(_blob: Blob) {
      this.onload?.();
    }
  } as unknown as typeof FileReader;
}

describe("removeImageBackground pipeline", () => {
  let api: typeof import("@/lib/media/backgroundRemoval");

  beforeEach(async () => {
    vi.resetModules();
    hoisted.pipelineMock.mockReset();
    vi.stubGlobal("FileReader", makeFileReader());
    api = await import("@/lib/media/backgroundRemoval");
  });

  it("runs the model pipeline and resolves a transparent PNG data URL", async () => {
    hoisted.pipelineMock.mockImplementation(async (_task, _model, opts) => {
      opts?.progress_callback?.({ status: "progress", progress: 50 });
      opts?.progress_callback?.({ progress: 30 });
      opts?.progress_callback?.({ status: "done" });
      return makeRemover();
    });
    const onProgress = vi.fn();
    const out = await api.removeImageBackground("data:image/png;base64,AAA", onProgress);
    expect(out).toBe("data:image/png;base64,FAKE");
    expect(hoisted.pipelineMock).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({ status: "init", progress: 50 });
    expect(onProgress).toHaveBeenCalledWith({ status: "init", progress: 30 });
    expect(onProgress).toHaveBeenCalledWith({ status: "ready" });
  });

  it("caches the warm pipeline across successive calls", async () => {
    hoisted.pipelineMock.mockResolvedValue(makeRemover());
    await api.removeImageBackground("u1");
    await api.removeImageBackground("u2");
    expect(hoisted.pipelineMock).toHaveBeenCalledTimes(1);
  });

  it("retries from scratch after a failed model load", async () => {
    hoisted.pipelineMock.mockRejectedValueOnce(new Error("boom"));
    await expect(api.removeImageBackground("u")).rejects.toThrow("boom");
    hoisted.pipelineMock.mockResolvedValue(makeRemover());
    await expect(api.removeImageBackground("u")).resolves.toBe("data:image/png;base64,FAKE");
    expect(hoisted.pipelineMock).toHaveBeenCalledTimes(2);
  });

  it("rejects when the cutout blob cannot be read", async () => {
    hoisted.pipelineMock.mockResolvedValue(makeRemover());
    vi.stubGlobal(
      "FileReader",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL(_blob: Blob) {
          this.onerror?.();
        }
      } as unknown as typeof FileReader
    );
    await expect(api.removeImageBackground("u")).rejects.toThrow(/Failed to read the cutout image/);
  });
});
