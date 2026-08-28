import type { EditorScene, MockupFrame, StylePreset } from "@/lib/types/editor";

/** A weighted entry in a spin pack rule list. */
export interface SpinWeighted<T> {
  id: T;
  /** Relative probability weight (default 1). */
  weight?: number;
}

/** A predefined pack of rules for the roulette. Each field restricts which
 *  values the picker can choose from; omitted fields use all defaults.
 *  Stateless — travels with the API request, no server-side storage needed. */
export interface SpinPack {
  /** Human-readable name (informational only). */
  name?: string;
  /** Allowed frame types. Omit to pick from all non-custom frames. */
  frames?: SpinWeighted<MockupFrame>[];
  /** Allowed background preset ids. Omit to use randomSceneStyle. */
  backgrounds?: SpinWeighted<string>[];
  /** Allowed style presets. Omit to pick from all four. */
  styles?: SpinWeighted<StylePreset>[];
  /** Tilt range in degrees. false = always 0, true = ±25, {min,max} = custom. Omit = ±10. */
  tilt?: { min: number; max: number } | boolean;
  /** Shadow opacity range. false = always 0.4, true = 0.2–0.6, {min,max} = custom. Omit = 0.2–0.6. */
  shadow?: { min: number; max: number } | boolean;
  /** Allowed border-radius values in px. Omit = [8,12,16,20,24,28,36]. */
  borderRadius?: number[];
  /** Allowed aspect ratios. Omit = ["16 / 9"]. */
  aspectRatio?: string[];
  /** Enable random watermark. Omit = false. */
  watermark?: boolean;
}

/** Request body for POST /api/spin. */
export interface SpinRequest {
  /** Inline pack definition. Omit for an empty pack (all defaults). */
  pack?: SpinPack;
  /** User media as a data URL or base64 string. */
  media?: string;
  /** Media MIME type hint (default "image"). */
  mediaType?: "image" | "video";
  /** Optional seed for deterministic output. Omit for random. */
  seed?: number;
  /** Response format (default "json"). "png" attempts a server-side render
   *  and returns the image bytes (falling back to JSON when the renderer is
   *  unavailable). */
  format?: "json" | "png";
  /** Quality multiplier for PNG output (1–4, default 2). */
  scale?: number;
  /** Explicit output width for PNG output. */
  width?: number;
  /** Explicit output height for PNG output. */
  height?: number;
}

/** Response from POST /api/spin. */
export interface SpinResponse {
  scene: EditorScene;
  /** The seed that was actually used (returned even when the client didn't send one). */
  seed: number;
  /** Present when `format: "png"` was requested but the server renderer was
   *  unavailable (no Chromium) — the caller can still work with the scene. */
  image?: null;
}

/** Arguments the server-side PNG renderer passes to the harness page's
 *  `window.__mocksyRender`. Rendered at exactly this pixel size. */
export interface SpinRenderRequest {
  scene: EditorScene;
  width: number;
  height: number;
}

/** Value the harness page's `window.__mocksyRender` resolves to — the rendered
 *  PNG as a data URL, or an error message. Crosses the Playwright boundary. */
export interface SpinRenderResult {
  dataUrl?: string;
  error?: string;
}
