import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene } from "@/lib/types/editor";

const buildStandaloneSvg = vi.fn();
vi.mock("@/lib/export/exportSvg", () => ({
  buildStandaloneSvg: (...args: unknown[]) => buildStandaloneSvg(...args)
}));

const renderSceneToPngBlob = vi.fn();
vi.mock("@/lib/export/exportImage", () => ({
  renderSceneToPngBlob: (...args: unknown[]) => renderSceneToPngBlob(...args)
}));

const downloadBlob = vi.fn();
vi.mock("@/lib/export/downloadBlob", () => ({
  downloadBlob: (...args: unknown[]) => downloadBlob(...args)
}));

const PDF_BLOB = new Blob(["%PDF-fake"], { type: "application/pdf" });

interface FakeDoc {
  opts: unknown;
  svg: ReturnType<typeof vi.fn>;
  addImage: ReturnType<typeof vi.fn>;
  output: ReturnType<typeof vi.fn>;
}

const pdfInstances: FakeDoc[] = [];
let failOutput = false;

class FakeJsPDF implements FakeDoc {
  opts: unknown;
  svg: ReturnType<typeof vi.fn>;
  addImage: ReturnType<typeof vi.fn>;
  output: ReturnType<typeof vi.fn>;
  constructor(opts: unknown) {
    this.opts = opts;
    this.svg = vi.fn().mockResolvedValue(undefined);
    this.addImage = vi.fn();
    this.output = vi.fn(() => {
      if (failOutput) throw new Error("OOM");
      return PDF_BLOB;
    });
    pdfInstances.push(this);
  }
}

vi.mock("jspdf", () => ({ jsPDF: FakeJsPDF }));
vi.mock("svg2pdf.js", () => ({}));

function sceneWith(overrides: Partial<EditorScene> = {}): EditorScene {
  return { ...initialScene, ...overrides };
}

function setupVectorDom() {
  vi.stubGlobal("SVGSVGElement", class FakeSvgElement {});
  const svgEl = new (globalThis.SVGSVGElement as unknown as new () => object)();
  const host = {
    setAttribute: vi.fn(),
    remove: vi.fn(),
    firstElementChild: svgEl,
    innerHTML: ""
  };
  Object.defineProperty(host, "innerHTML", {
    set(value: string) {
      void value;
    }
  });
  const appendChild = vi.fn();
  vi.stubGlobal("document", {
    body: { appendChild },
    createElement: vi.fn(() => host)
  });
  return { host, svgEl, appendChild };
}

describe("pdfPageSize", () => {
  it("defaults to the intrinsic artboard size", async () => {
    const { pdfPageSize } = await import("@/lib/export/exportPdf");
    expect(pdfPageSize(sceneWith())).toEqual({ width: 800, height: 450 });
  });

  it("uses the custom size verbatim so the raster fallback is not stretched", async () => {
    const { pdfPageSize } = await import("@/lib/export/exportPdf");
    expect(pdfPageSize(sceneWith(), { width: 1280, height: 720 })).toEqual({ width: 1280, height: 720 });
    // The page keeps the requested size even when its aspect differs from the
    // scene's: the raster fallback renders a customSize-canvas (letterboxed),
    // so scaling the artboard to fit a box instead would stretch the image
    // when the aspects mismatch.
    expect(pdfPageSize(sceneWith(), { width: 400, height: 600 })).toEqual({ width: 400, height: 600 });
  });

  it("ignores an empty custom size", async () => {
    const { pdfPageSize } = await import("@/lib/export/exportPdf");
    expect(pdfPageSize(sceneWith(), { width: 0, height: 0 })).toEqual({ width: 800, height: 450 });
  });

  it("ignores a partial custom size (missing dimension) instead of a 1x1 page", async () => {
    const { pdfPageSize } = await import("@/lib/export/exportPdf");
    expect(pdfPageSize(sceneWith(), { width: 1200, height: 0 })).toEqual({ width: 800, height: 450 });
    expect(pdfPageSize(sceneWith(), { width: 0, height: 1200 })).toEqual({ width: 800, height: 450 });
  });
});

describe("exportPdf", () => {
  beforeEach(() => {
    pdfInstances.length = 0;
    buildStandaloneSvg.mockReset();
    renderSceneToPngBlob.mockReset();
    downloadBlob.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders a vector PDF from the shared SVG markup", async () => {
    buildStandaloneSvg.mockResolvedValue({markup: "<svg/>", width: 800, height: 450});
    const { host, svgEl, appendChild } = setupVectorDom();

    const { exportPdf } = await import("@/lib/export/exportPdf");
    await exportPdf(initialScene, "preview", "mocksy-export");

    expect(buildStandaloneSvg).toHaveBeenCalledWith(initialScene, "preview", initialScene.activeLayerId);
    expect(appendChild).toHaveBeenCalledWith(host);
    expect(pdfInstances).toHaveLength(1);
    expect(pdfInstances[0]!.opts).toMatchObject({ unit: "pt", format: [800, 450], orientation: "landscape" });
    expect(pdfInstances[0]!.svg).toHaveBeenCalledWith(svgEl, { x: 0, y: 0, width: 800, height: 450 });
    expect(downloadBlob).toHaveBeenCalledWith(PDF_BLOB, "mocksy-export.pdf");
    expect(renderSceneToPngBlob).not.toHaveBeenCalled();
    expect(host.remove).toHaveBeenCalled();
  });

  it("falls back to a raster PNG page when vector rendering fails", async () => {
    buildStandaloneSvg.mockRejectedValue(new Error("unsupported filter"));
    renderSceneToPngBlob.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    setupVectorDom();

    const { exportPdf } = await import("@/lib/export/exportPdf");
    const onError = vi.fn();
    await exportPdf(initialScene, "preview", "mocksy-export", onError, 2);

    expect(onError).not.toHaveBeenCalled();
    expect(pdfInstances[0]!.addImage).toHaveBeenCalledWith(expect.any(Uint8Array), "PNG", 0, 0, 800, 450);
    expect(pdfInstances[0]!.svg).not.toHaveBeenCalled();
    expect(downloadBlob).toHaveBeenCalledWith(PDF_BLOB, "mocksy-export.pdf");
    expect(console.warn).toHaveBeenCalled();
  });

  it("reports an error when the raster fallback cannot render the scene", async () => {
    buildStandaloneSvg.mockRejectedValue(new Error("boom"));
    renderSceneToPngBlob.mockResolvedValue(null);

    const { exportPdf } = await import("@/lib/export/exportPdf");
    const onError = vi.fn();
    await exportPdf(initialScene, "preview", "mocksy-export", onError);

    expect(onError).toHaveBeenCalledWith("Failed to render scene for PDF.");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("reports an error when the PDF cannot be built", async () => {
    buildStandaloneSvg.mockRejectedValue(new Error("boom"));
    renderSceneToPngBlob.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    failOutput = true;

    try {
      const { exportPdf } = await import("@/lib/export/exportPdf");
      const onError = vi.fn();
      await exportPdf(initialScene, "preview", "mocksy-export", onError);

      expect(onError).toHaveBeenCalledWith("OOM");
      expect(downloadBlob).not.toHaveBeenCalled();
    } finally {
      failOutput = false;
    }
  });

  it("keeps the custom filename extension", async () => {
    buildStandaloneSvg.mockResolvedValue({markup: "<svg/>", width: 800, height: 450});
    setupVectorDom();

    const { exportPdf } = await import("@/lib/export/exportPdf");
    await exportPdf(initialScene, "preview", "my-scene");

    expect(downloadBlob).toHaveBeenCalledWith(PDF_BLOB, "my-scene.pdf");
  });
});
