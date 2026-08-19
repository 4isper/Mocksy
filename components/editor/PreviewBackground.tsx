"use client";

import type { CSSProperties } from "react";
import type { SceneCss } from "@/lib/render/mockupRenderer";

/** Background blur layer (the scene background, blurred and expanded to avoid
 *  edge bleed) and the optional alignment grid overlay. */
export function PreviewBackground({
  sceneCss,
  showGrid,
  gridDivisions
}: {
  sceneCss: SceneCss;
  showGrid: boolean;
  gridDivisions: number;
}) {
  return (
    <>
      {sceneCss.backgroundImage ? (
        <div
          data-bg
          aria-hidden
          style={{
            position: "absolute",
            inset: -(sceneCss.backgroundBlur + 6),
            zIndex: 0,
            backgroundImage: `url("${sceneCss.backgroundImage}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: sceneCss.backgroundBlur > 0 ? `blur(${sceneCss.backgroundBlur}px)` : undefined,
            pointerEvents: "none"
          }}
        />
      ) : null}
      {showGrid ? (
        <div
          data-grid-overlay
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            backgroundImage: [
              "repeating-linear-gradient(to right, rgba(255,255,255,0.07) 0 1px, transparent 1px 100%)",
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.07) 0 1px, transparent 1px 100%)"
            ].join(", "),
            backgroundSize: `${100 / gridDivisions}% ${100 / gridDivisions}%`
          } as CSSProperties}
        />
      ) : null}
    </>
  );
}
