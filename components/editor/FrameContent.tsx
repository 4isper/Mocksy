import type { ReactNode } from "react";
import type { SceneCss } from "@/lib/render/mockupRenderer";

/**
 * Canonical paint order inside a mockup frame, shared by every live-preview
 * renderer (single view, frame grid, OG image): media → glare → empty-media
 * placeholder → screen chrome → device skin → browser URL. It must mirror the
 * canvas export (`drawFrameCanvas` in lib/render/canvasDrawing.ts) — if the
 * media ever paints above the chrome or the skin again, the notch and the
 * lock/home/status-bar decoration disappear from the preview while exports
 * stay correct.
 *
 * `media` and `emptyMedia` are caller-owned slots because each surface wires
 * different handlers (pan/seek/analysis), but their *position* in the order is
 * fixed here and cannot diverge anymore.
 */
export function FrameContent({
  css,
  media = null,
  emptyMedia = null
}: {
  css: SceneCss;
  /** The uploaded photo/video element, painted below everything else. */
  media?: ReactNode;
  /** Placeholder shown when no media is loaded (single view only). */
  emptyMedia?: ReactNode;
}) {
  return (
    <>
      {media}
      {css.screenGlareStyle ? <div aria-hidden style={css.screenGlareStyle} /> : null}
      {emptyMedia}
      {css.screenChrome ? (
        <div
          aria-hidden
          style={css.screenChromeStyle}
          dangerouslySetInnerHTML={{ __html: css.screenChrome }}
        />
      ) : null}
      {css.frameOverlay ? (
        <img
          src={css.frameOverlay}
          alt=""
          aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", ...css.overlayStyle }}
        />
      ) : null}
      {css.browserChrome && css.browserChromeStyle ? (
        <div
          aria-hidden
          style={css.browserChromeStyle}
          dangerouslySetInnerHTML={{ __html: css.browserChrome }}
        />
      ) : null}
    </>
  );
}
