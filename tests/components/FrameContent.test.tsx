// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { FrameContent } from "@/components/editor/FrameContent";
import type { SceneCss } from "@/lib/render/mockupRenderer";

afterEach(cleanup);

const css: SceneCss = {
  screenGlareStyle: { position: "absolute", background: "#010203" },
  screenChrome: '<svg class="chrome" xmlns="http://www.w3.org/2000/svg" />',
  screenChromeStyle: { position: "absolute" },
  frameOverlay: "data:image/svg+xml;base64,AAAA",
  browserChrome: '<svg class="browser" xmlns="http://www.w3.org/2000/svg" />',
  browserChromeStyle: { position: "absolute" }
} as unknown as SceneCss;

/** Canonical order must mirror the canvas export (drawFrameCanvas): media →
 *  glare → empty placeholder → screen chrome → device skin → browser URL. */
describe("FrameContent paint order", () => {
  it("renders every layer in export order", () => {
    const { container } = render(
      <FrameContent
        css={css}
        media={<img data-testid="media" alt="" />}
        emptyMedia={<div data-testid="empty" />}
      />
    );
    const role = (el: Element) => {
      const slot = el.getAttribute("data-testid");
      if (slot === "media" || slot === "empty") return slot;
      if (el.tagName === "IMG") return "overlay";
      const svg = el.querySelector("svg");
      if (svg?.classList.contains("chrome")) return "chrome";
      if (svg?.classList.contains("browser")) return "browser";
      return "glare";
    };
    expect(Array.from(container.children).map(role)).toEqual([
      "media",
      "glare",
      "empty",
      "chrome",
      "overlay",
      "browser"
    ]);
  });

  it("omits absent layers without breaking the order", () => {
    const bare = {
      screenGlareStyle: null,
      screenChrome: null,
      frameOverlay: null,
      browserChrome: null,
      browserChromeStyle: null
    } as unknown as SceneCss;
    const { container } = render(<FrameContent css={bare} media={<img data-testid="media" alt="" />} />);
    expect(container.children).toHaveLength(1);
  });
});
