import type { EditorScene, MockupFrame, StylePreset } from "@/lib/types/editor";
import type { SpinPack, SpinResponse, SpinWeighted } from "@/lib/types/spin";
import { FRAME_ORDER } from "@/lib/render/frames";
import { backgroundPresets, randomSceneStyle } from "@/lib/presets/presets";
import { initialScene } from "@/lib/state/editorScene";
import { makeDemoLayer } from "@/lib/state/layerHelpers";
import { normalizeScene } from "@/lib/state/normalizeScene";

/** Style presets the editor can render (also the picker's default pool). */
export const SPIN_STYLE_PRESETS: StylePreset[] = ["default", "glassLight", "glassDark", "outline"];

/** Default border-radius pool in px. */
const SPIN_RADII = [8, 12, 16, 20, 24, 28, 36];

/** Default tilt range in degrees when the pack stays silent. */
const DEFAULT_TILT: [number, number] = [-10, 10];

/** Default shadow-opacity range. */
const DEFAULT_SHADOW: [number, number] = [0.2, 0.6];

const WATERMARK_TEXTS = ["Mocksy", "Made with Mocksy"];
const WATERMARK_POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"] as const;

/**
 * Mulberry32 — a tiny, fast, deterministic PRNG. Same seed always produces the
 * same sequence, so a spin with a fixed seed is reproducible across requests
 * and runs (bots can "re-roll the same frame" by replaying a seed).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A crypto-grade random seed for spins where the client didn't supply one. */
export function randomSeed(): number {
  return typeof crypto !== "undefined" && "getRandomValues" in crypto
    ? crypto.getRandomValues(new Uint32Array(1))[0] ?? Math.floor(Math.random() * 0x7fffffff)
    : Math.floor(Math.random() * 0x7fffffff);
}

/** Picks one item from a weighted list. Unknown ids are dropped during
 *  sanitization, so `items` is trusted by the time this runs. */
function pickWeighted<T extends string>(items: SpinWeighted<T>[], rand: () => number): T {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight ?? 1), 0);
  if (total <= 0) return items[0]!.id;
  let roll = rand() * total;
  for (const item of items) {
    roll -= Math.max(0, item.weight ?? 1);
    if (roll < 0) return item.id;
  }
  return items[items.length - 1]!.id;
}

function pickOne<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)]!;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pickRange(rand: () => number, range: [number, number]): number {
  const [min, max] = range;
  return min + rand() * (max - min);
}

/** Filters a weighted list down to entries whose ids belong to `allowed`,
 *  coercing garbage weights to positive numbers. Returns null when nothing
 *  survives, so the caller falls back to its default pool. */
function sanitizeWeighted<T extends string>(
  items: unknown,
  allowed: readonly T[]
): SpinWeighted<T>[] | null {
  if (!Array.isArray(items)) return null;
  const out: SpinWeighted<T>[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const { id, weight } = item as { id?: unknown; weight?: unknown };
    if (typeof id !== "string" || !allowed.includes(id as T)) continue;
    const w = typeof weight === "number" && Number.isFinite(weight) && weight > 0 ? weight : 1;
    // Only carry the explicit weight when it differs from the default so a
    // pack like `[{id:"iphone"}]` round-trips exactly as typed.
    out.push(w === 1 ? { id: id as T } : { id: id as T, weight: w });
  }
  return out.length > 0 ? out : null;
}

/**
 * Defensively normalizes an untrusted pack payload (it originates from the
 * public API), mirroring the `normalizeScene` philosophy: unknown ids are
 * dropped, out-of-range numbers are clamped, and empty lists fall back to the
 * picker's defaults. Never throws.
 */
export function sanitizePack(pack: unknown): SpinPack {
  if (typeof pack !== "object" || pack === null) return {};
  const source = pack as Record<string, unknown>;
  const result: SpinPack = {};

  if (typeof source.name === "string" && source.name.length > 0) {
    result.name = source.name.slice(0, 100);
  }
  const frames = sanitizeWeighted<MockupFrame>(source.frames, FRAME_ORDER);
  if (frames) result.frames = frames;
  const styles = sanitizeWeighted<StylePreset>(source.styles, SPIN_STYLE_PRESETS);
  if (styles) result.styles = styles;
  const backgrounds = sanitizeWeighted(
    source.backgrounds,
    backgroundPresets.map((p) => p.id)
  );
  if (backgrounds) result.backgrounds = backgrounds;

  if (source.tilt === false || source.tilt === true) {
    result.tilt = source.tilt;
  } else if (typeof source.tilt === "object" && source.tilt !== null) {
    const { min, max } = source.tilt as { min?: unknown; max?: unknown };
    if (typeof min === "number" && typeof max === "number") {
      result.tilt = { min: clamp(min, -25, 25), max: clamp(max, -25, 25) };
    }
  }

  if (source.shadow === false || source.shadow === true) {
    result.shadow = source.shadow;
  } else if (typeof source.shadow === "object" && source.shadow !== null) {
    const { min, max } = source.shadow as { min?: unknown; max?: unknown };
    if (typeof min === "number" && typeof max === "number") {
      result.shadow = { min: clamp(min, 0, 1), max: clamp(max, 0, 1) };
    }
  }

  const borderRadius = Array.isArray(source.borderRadius)
    ? source.borderRadius
        .filter((v) => typeof v === "number" && Number.isFinite(v))
        .map((v) => clamp(v as number, 0, 100))
    : null;
  if (borderRadius && borderRadius.length > 0) result.borderRadius = borderRadius;

  const aspectRatio = Array.isArray(source.aspectRatio)
    ? source.aspectRatio.filter((v): v is string => typeof v === "string")
    : null;
  if (aspectRatio && aspectRatio.length > 0) result.aspectRatio = aspectRatio;

  if (source.watermark === true) result.watermark = true;

  return result;
}

function resolveBackground(backgrounds: SpinWeighted<string>[], rand: () => number): Partial<EditorScene> {
  // Pick exactly once — calling pickWeighted inside the find predicate would
  // re-roll the RNG on every element and return a different id each time, so
  // the find could miss an id that actually exists.
  const picked = pickWeighted(backgrounds, rand);
  const preset = backgroundPresets.find((p) => p.id === picked);
  if (!preset) return {};
  return {
    backgroundMode: preset.kind,
    backgroundColor: preset.backgroundColor ?? preset.swatch,
    gradientFrom: preset.gradientFrom ?? preset.swatch,
    gradientTo: preset.gradientTo ?? preset.swatch,
    gradientVia: null,
    gradientType: "linear",
    gradientAngle: Math.floor(rand() * 360),
    patternId: preset.patternId ?? null
  };
}

/**
 * Spins the roulette: picks a frame, background, style, tilt, shadow, corner
 * radius and aspect ratio from the pack's allowed rules (or the picker's
 * defaults), then applies them to `baseScene`. Pure and deterministic: the
 * same (baseScene, pack, seed) triple always yields the same scene.
 *
 * Media layers are not touched — callers keep their own layers — except that
 * single media can be injected afterwards via `applySpinMedia`.
 */
export function spinScene(baseScene: EditorScene, pack: SpinPack, seed?: number): SpinResponse {
  const actualSeed = seed ?? randomSeed();
  const rand = mulberry32(actualSeed);
  const clean = sanitizePack(pack);

  // Frame — from the pack's whitelist or the full non-custom pool.
  const frames = clean.frames ?? FRAME_ORDER.map((id) => ({ id }));
  const frame = pickWeighted<MockupFrame>(frames, rand);

  // Appearance. When the pack lists backgrounds, pick one; otherwise reuse the
  // editor's "Surprise me" engine. (The backgroundMode "image" from a pack
  // background is never produced — backgroundPresets only know transparent/
  // solid/gradient/pattern.)
  const appearance: Partial<EditorScene> = clean.backgrounds
    ? resolveBackground(clean.backgrounds, rand)
    : randomSceneStyle(rand);

  // Style: the pack whitelist wins over whatever the appearance picked.
  const stylePreset = clean.styles
    ? pickWeighted<StylePreset>(clean.styles, rand)
    : appearance.stylePreset ?? "default";

  // Shadow: pack range wins, else fall back to whatever the appearance picked.
  let shadowOpacity = appearance.shadowOpacity ?? initialScene.shadowOpacity;
  if (clean.shadow === false) shadowOpacity = initialScene.shadowOpacity;
  else if (clean.shadow === true) shadowOpacity = Math.round(pickRange(rand, DEFAULT_SHADOW) * 100) / 100;
  else if (typeof clean.shadow === "object") {
    shadowOpacity = Math.round(pickRange(rand, [clean.shadow.min, clean.shadow.max]) * 100) / 100;
  }

  // Corner radius: explicit pack list or the default pool.
  const borderRadius = pickOne(clean.borderRadius ?? SPIN_RADII, rand);

  // Tilt: disabled, full range, pack range, or the modest default.
  let tiltX = 0;
  let tiltY = 0;
  if (clean.tilt !== false) {
    const range: [number, number] =
      clean.tilt === true ? [-25, 25] : typeof clean.tilt === "object" ? [clean.tilt.min, clean.tilt.max] : DEFAULT_TILT;
    tiltX = Math.round(pickRange(rand, range));
    tiltY = Math.round(pickRange(rand, range));
  }

  // Aspect ratio: from the pack's list or stay at the base scene's.
  const aspectRatio = clean.aspectRatio && clean.aspectRatio.length > 0
    ? pickOne(clean.aspectRatio, rand)
    : baseScene.aspectRatio;

  const scene: EditorScene = {
    ...baseScene,
    ...appearance,
    frame,
    stylePreset,
    shadowOpacity,
    borderRadius,
    tiltX,
    tiltY,
    aspectRatio,
    frameInstances: [],
    annotations: [],
    watermarkEnabled: clean.watermark
      ? rand() < 0.5
      : baseScene.watermarkEnabled,
    watermarkText: clean.watermark ? pickOne(WATERMARK_TEXTS, rand) : baseScene.watermarkText,
    watermarkPosition: clean.watermark ? pickOne(WATERMARK_POSITIONS, rand) : baseScene.watermarkPosition
  };

  return { scene: normalizeScene(scene), seed: actualSeed };
}

/** Injects a single user-provided media layer into the spun scene, replacing
 *  the demo layer. Video keeps its poster time at 0 so the first frame shows
 *  immediately in a static render. Pure. */
export function applySpinMedia(scene: EditorScene, mediaUrl: string, mediaType: "image" | "video"): EditorScene {
  const layer = {
    ...makeDemoLayer(),
    mediaUrl,
    mediaType,
    mediaName: mediaType === "image" ? "spin-media" : "spin-media.mp4"
  };
  return normalizeScene({
    ...scene,
    layers: [layer],
    activeLayerId: layer.id
  });
}