import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { initialScene } from "@/lib/state/editorStore";

const renderSceneToPngBlob = vi.fn();
vi.mock("@/lib/export/exportImage", () => ({
  renderSceneToPngBlob: (...args: unknown[]) => renderSceneToPngBlob(...args)
}));

const addPage = vi.fn();
const drawImage = vi.fn();
const embedPng = vi.fn();
const save = vi.fn();
const create = vi.fn();
vi.mock("pdf-lib", () => ({
  PDFDocument: {
    create: (...args: unknown[]) => create(...args)
  }
}));

function setupPdfLib() {
  addPage.mockReset();
  drawImage.mockReset();
  embedPng.mockReset();
  save.mockReset();
  create.mockReset();
  embedPng.mockResolvedValue({ width: 800, height: 600 });
  save.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  addPage.mockReturnValue({ drawImage });
  create.mockResolvedValue({ addPage, embedPng, save });
}

function setupDom() {
  const links: Array<{ href: string; download: string; click: ReturnType<typeof vi.fn> }> = [];
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      if (tag === "a") {
        const link = { href: "", download: "", click: vi.fn() };
        links.push(link);
        return link;
      }
      return null;
    }
  });
  vi.stubGlobal("URL", Object.assign(globalThis.URL, {
    createObjectURL: vi.fn(() => "blob:pdf"),
    revokeObjectURL: vi.fn()
  }));
  return links;
}

describe("exportPdf", () => {
  beforeEach(() => {
    setupPdfLib();
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("embeds the rendered PNG into a single-page PDF and triggers a download", async () => {
    renderSceneToPngBlob.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    const links = setupDom();

    const { exportPdf } = await import("@/lib/export/exportPdf");
    const onError = vi.fn();
    await exportPdf(initialScene, "preview", "mocksy-export", onError);

    expect(onError).not.toHaveBeenCalled();
    expect(renderSceneToPngBlob).toHaveBeenCalledWith(initialScene, "preview", onError, undefined, undefined, initialScene.activeLayerId);
    expect(create).toHaveBeenCalled();
    expect(embedPng).toHaveBeenCalled();
    expect(addPage).toHaveBeenCalledWith([612, expect.any(Number)]);
    expect(drawImage).toHaveBeenCalled();
    expect(links[0]?.download).toBe("mocksy-export.pdf");
    expect(links[0]?.click).toHaveBeenCalled();
  });

  it("respects the custom page width when provided", async () => {
    renderSceneToPngBlob.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    setupDom();

    const { exportPdf } = await import("@/lib/export/exportPdf");
    await exportPdf(initialScene, "preview", "mocksy-export", vi.fn(), 2, { width: 1280, height: 720 });

    // 1280-wide page; height derived from the 4:3 PNG aspect (800×600).
    expect(addPage).toHaveBeenCalledWith([1280, 960]);
  });

  it("reports an error when the PNG render fails", async () => {
    renderSceneToPngBlob.mockResolvedValue(null);
    setupDom();

    const { exportPdf } = await import("@/lib/export/exportPdf");
    const onError = vi.fn();
    await exportPdf(initialScene, "preview", "mocksy-export", onError);

    expect(onError).toHaveBeenCalledWith("Failed to render scene for PDF.");
    expect(create).not.toHaveBeenCalled();
  });

  it("reports an error when the PDF cannot be built", async () => {
    renderSceneToPngBlob.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    create.mockRejectedValue(new Error("OOM"));
    setupDom();

    const { exportPdf } = await import("@/lib/export/exportPdf");
    const onError = vi.fn();
    await exportPdf(initialScene, "preview", "mocksy-export", onError);

    expect(onError).toHaveBeenCalledWith("OOM");
  });
});
