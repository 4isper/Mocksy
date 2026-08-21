import { describe, expect, it, vi } from "vitest";
import {
  BROWSER_PILL,
  BROWSER_URL_FONT_SIZE,
  BROWSER_URL_PADDING,
  BROWSER_VIEWBOX,
  browserChromeSvg,
  browserUrlSvg,
  drawBrowserUrl,
  fitBrowserUrl,
  isBrowserFrameSpec
} from "@/lib/render/browserChrome";
import { FRAME_SPECS } from "@/lib/render/frames";
import type { FrameBox } from "@/lib/render/frameGeometry";

const BOX: FrameBox = {
  x: 100,
  y: 50,
  width: 720,
  height: 500,
  outerRadius: 10,
  innerX: 100,
  innerY: 95.8,
  innerW: 720,
  innerH: 452,
  innerRadius: 10
};

describe("fitBrowserUrl", () => {
  it("returns short URLs unchanged", () => {
    expect(fitBrowserUrl("mocksy.app")).toBe("mocksy.app");
  });

  it("trims surrounding whitespace", () => {
    expect(fitBrowserUrl("  example.com  ")).toBe("example.com");
  });

  it("truncates long URLs with an ellipsis inside the pill", () => {
    const long = "https://example.com/" + "a".repeat(300);
    const out = fitBrowserUrl(long);
    expect(out.endsWith("…")).toBe(true);
    // Estimated text width must fit the pill's inner width.
    expect(out.length * BROWSER_URL_FONT_SIZE * 0.52).toBeLessThanOrEqual(BROWSER_PILL.w - BROWSER_URL_PADDING * 2 + 1);
  });
});

describe("browserUrlSvg", () => {
  it("positions the text at the pill's left edge, vertically centered", () => {
    const out = browserUrlSvg("mocksy.app");
    expect(out).toContain(`<text x="${BROWSER_PILL.x + 24}"`);
    expect(out).toContain(`y="${BROWSER_PILL.y + BROWSER_PILL.h / 2}"`);
    expect(out).toContain(`font-size="${BROWSER_URL_FONT_SIZE}"`);
    expect(out).toContain('dominant-baseline="central"');
    expect(out).toContain("mocksy.app");
  });

  it("escapes markup-significant characters in the URL", () => {
    const out = browserUrlSvg('https://example.com/?a=1&b=<2>"x"');
    expect(out).not.toContain("<2>");
    expect(out).toContain("&amp;");
    expect(out).toContain("&lt;2&gt;");
    expect(out).toContain("&quot;x&quot;");
  });

  it("emits the truncated URL for overlong input", () => {
    const out = browserUrlSvg("https://example.com/" + "a".repeat(300));
    expect(out).toContain("…");
    expect(out).not.toContain("a".repeat(300));
  });
});

describe("browserChromeSvg", () => {
  it("wraps the URL text in a full-frame SVG matching the skin viewBox", () => {
    const out = browserChromeSvg("mocksy.app");
    expect(out).toContain(`viewBox="0 0 ${BROWSER_VIEWBOX.w} ${BROWSER_VIEWBOX.h}"`);
    expect(out).toContain('width="100%"');
    expect(out).toContain('height="100%"');
    expect(out).toContain("<text ");
  });
});

describe("isBrowserFrameSpec", () => {
  it("is true only for the browser frame spec", () => {
    expect(isBrowserFrameSpec(FRAME_SPECS.browser)).toBe(true);
    expect(isBrowserFrameSpec(FRAME_SPECS.macbook)).toBe(false);
    expect(isBrowserFrameSpec(FRAME_SPECS.none)).toBe(false);
  });
});

describe("drawBrowserUrl", () => {
  function mockCtx() {
    return {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      fillText: vi.fn()
    };
  }

  it("maps viewBox units onto the frame box and draws the fitted URL", () => {
    const ctx = mockCtx();
    drawBrowserUrl(ctx as unknown as CanvasRenderingContext2D, BOX, FRAME_SPECS.browser, "mocksy.app");
    expect(ctx.translate).toHaveBeenCalledWith(BOX.x, BOX.y);
    expect(ctx.scale).toHaveBeenCalledWith(BOX.width / BROWSER_VIEWBOX.w, BOX.height / BROWSER_VIEWBOX.h);
    expect(ctx.fillText).toHaveBeenCalledWith("mocksy.app", BROWSER_PILL.x + 24, BROWSER_PILL.y + BROWSER_PILL.h / 2);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("draws the truncated URL for overlong input", () => {
    const ctx = mockCtx();
    drawBrowserUrl(
      ctx as unknown as CanvasRenderingContext2D,
      BOX,
      FRAME_SPECS.browser,
      "https://example.com/" + "a".repeat(300)
    );
    const drawn = ctx.fillText.mock.calls[0]![0] as string;
    expect(drawn.endsWith("…")).toBe(true);
  });
});
