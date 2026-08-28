import { NextResponse } from "next/server";
import { renderSceneToPngBuffer } from "@/lib/server/pngRender";
import type { SpinRequest } from "@/lib/types/spin";
import { applySpinMedia, spinScene } from "@/lib/presets/spinPicker";
import { resolveSpinRenderSize } from "@/lib/export/exportSize";
import { initialScene } from "@/lib/state/editorScene";

/** Route handler body size limit — the whole request lives in JSON, so a large
 *  media data URL is the main budget. Set above the editor's 64KB inline
 *  threshold (IndexedDB offload is a client concern) yet bounded so a runaway
 *  caller can't OOM the renderer. */
const MAX_MEDIA_LENGTH = 32 * 1024 * 1024;

/** Media must arrive as a data URL so the scene stays self-contained (the
 *  editor renders data: URLs only; remote URLs would need server-side fetch
 *  and open an SSRF/validation hole). */
const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+);/i;

function parseSeed(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >>> 0;
}

export async function POST(request: Request): Promise<Response> {
  let body: SpinRequest;
  try {
    const parsed = (await request.json()) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    body = parsed as SpinRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { pack, media, mediaType, seed, format, scale, width, height } = body;

  if (media != null) {
    if (typeof media !== "string" || media.length === 0) {
      return NextResponse.json({ error: "`media` must be a base64 data URL." }, { status: 400 });
    }
    if (!DATA_URL_RE.test(media)) {
      return NextResponse.json(
        { error: "`media` must be a data URL (data:image/*;base64,... or data:video/*;base64,...)." },
        { status: 400 }
      );
    }
    if (media.length > MAX_MEDIA_LENGTH) {
      return NextResponse.json({ error: "`media` exceeds the 32MB size limit." }, { status: 413 });
    }
  }

  const type = mediaType === "video" ? "video" : "image";

  const { scene, seed: usedSeed } = spinScene(
    structuredClone(initialScene),
    pack ?? {},
    seed ?? undefined
  );

  const framed = media != null ? applySpinMedia(scene, media, type) : scene;

  const wantPng = (format ?? readQueryFormat(request.url)) === "png";
  if (!wantPng) {
    return NextResponse.json(
      { scene: framed, seed: usedSeed },
      { status: 200, headers: corsHeaders() }
    );
  }

  // PNG output: drive the harness page in headless Chromium. When the renderer
  // is unavailable (no browsers installed) or fails, fall back to the scene so
  // the caller still gets something useful, flagged via `image: null`.
  const size = resolveSpinRenderSize(framed, { scale, width, height });
  const pageUrl = new URL("/en/spin-render", request.url).toString();
  const png = await renderSceneToPngBuffer({
    scene: framed,
    width: size.width,
    height: size.height,
    pageUrl
  });
  if (png) {
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Mocksy-Seed": String(usedSeed),
        "X-Mocksy-Frame": framed.frame,
        ...corsHeaders()
      }
    });
  }
  return NextResponse.json(
    { scene: framed, seed: usedSeed, image: null },
    { status: 200, headers: corsHeaders() }
  );
}

/** Lets curl callers pick the format via `?format=png` as well as the body. */
function readQueryFormat(url: string): string | null {
  try {
    const u = new URL(url);
    const f = u.searchParams.get("format");
    return f === "json" || f === "png" ? f : null;
  } catch {
    return null;
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders(), Allow: "POST, OPTIONS" }
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}