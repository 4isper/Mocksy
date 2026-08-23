import type { Metadata } from "next";
import { DEMO_MEDIA_URL } from "@/lib/media/demoMedia";
import { buildOgScene } from "@/lib/state/ogScene";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { collectOverlayClipDefs } from "@/lib/render/squircle";
import { frameInstAr } from "@/lib/render/frames";
import { FrameContent } from "@/components/editor/FrameContent";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

/** Static 1200x630 composition screenshotted by scripts/generate-og.mjs to
 *  produce public/og-image.png. Server-rendered: buildSceneCss is pure. The
 *  markup mirrors FrameInstanceGrid's portrait path without store wiring. */
export default function OgImagePage() {
  const scene = buildOgScene();
  const sceneCss = buildSceneCss(scene);
  const layers = scene.frameInstances.map((inst) => ({
    inst,
    layer: scene.layers.find((l) => l.id === inst.layerId),
    css: buildSceneCss({ ...scene, frame: inst.frame, activeLayerId: inst.layerId })
  }));
  return (
    <div style={{ width: 1200, height: 630, overflow: "hidden", background: "#0a0a0a" }}>
      <div
        id="preview-canvas"
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          borderRadius: 0,
          overflow: "hidden",
          ...sceneCss.container
        }}
      >
        <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
          <defs>
            {collectOverlayClipDefs(scene).map((def) => (
              <clipPath key={def.id} id={def.id} clipPathUnits="objectBoundingBox">
                <path d={def.d} />
              </clipPath>
            ))}
          </defs>
        </svg>
        {layers.map(({ inst, layer, css }) => {
          const native = frameInstAr(inst.frame, scene.customFrame, scene.aspectRatio) ?? 390 / 844;
          return (
            <div
              key={inst.id}
              style={{
                position: "absolute",
                left: `${inst.x * 100}%`,
                top: `${inst.y * 100}%`,
                width: `${inst.scale * 100}%`,
                height: "auto",
                transform: "translate(-50%, -50%)",
                aspectRatio: `1 / ${native}`
              }}
            >
              <div style={{ ...css.frame, width: "100%", height: "100%", position: "relative" }}>
                <FrameContent
                  css={css}
                  media={<img src={layer?.mediaUrl ?? DEMO_MEDIA_URL} alt="" style={css.mediaStyle} />}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
