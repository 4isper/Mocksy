"use client";

import { useEffect } from "react";
import type { SpinRenderRequest, SpinRenderResult } from "@/lib/types/spin";
import { renderSceneToImageBlob } from "@/lib/export/exportImage";

/**
 * Server-render harness. The headless-Chromium renderer in lib/server/
 * navigates here and calls `window.__mocksyRender(scene, width, height)`,
 * which runs the exact client PNG export pipeline and returns a data URL.
 * Not linked from anywhere in the UI — it exists purely as a render target,
 * and is kept under a [locale] segment so the app's normal bundles resolve
 * the worker + `@/` imports.
 */

export const dynamic = "force-dynamic";

const CONTAINER_ID = "spin-render-root";

export default function SpinRenderPage() {
  useEffect(() => {
    async function render(req: SpinRenderRequest): Promise<SpinRenderResult> {
      try {
        const root = document.getElementById(CONTAINER_ID);
        if (!root) return { error: "render container missing" };

        root.replaceChildren();
        const active =
          req.scene.layers.find((l) => l.id === req.scene.activeLayerId) ?? req.scene.layers[0];
        if (active && active.mediaUrl && !active.hidden && active.mediaType !== "video") {
          const img = document.createElement("img");
          img.src = active.mediaUrl;
          img.dataset.layerMedia = active.id;
          img.decoding = "async";
          root.appendChild(img);
        }

        const blob = await renderSceneToImageBlob(
          req.scene,
          CONTAINER_ID,
          "image/png",
          (message) => console.error("spin-render:", message),
          undefined,
          { width: req.width, height: req.height }
        );
        if (!blob) return { error: "render pipeline returned no blob" };

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("FileReader failed"));
          reader.readAsDataURL(blob);
        });
        return { dataUrl };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    const api = window as unknown as { __mocksyRender?: (req: SpinRenderRequest) => Promise<SpinRenderResult> };
    api.__mocksyRender = render;
    return () => {
      delete api.__mocksyRender;
    };
  }, []);

  return <div id={CONTAINER_ID} className="hidden" />;
}