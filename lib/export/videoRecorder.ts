"use client";

import type { EditorScene } from "@/lib/types/editor";
import { renderMockupToCanvas } from "@/lib/render/renderMockup";
import type { RenderTransform } from "@/lib/render/frameGeometry";
import { sampleVideoTransform } from "@/lib/render/videoComposer";
import { chooseWebmMimeType, computeCaptureDuration } from "@/lib/export/videoExportHelpers";
import { loadExportAssets } from "@/lib/export/exportAssets";

/** Waits until every given <video> has decoded a frame (readyState >= 2) so a
 *  recording doesn't open with black frames. Never rejects: unplayable sources
 *  give up after `timeoutMs` and the exporter falls back to today's head-black
 *  behavior instead of hanging. */
export async function waitForDecodedFrame(videos: HTMLVideoElement[], timeoutMs = 2000): Promise<void> {
  const pending = videos.filter((v) => v.readyState < 2);
  if (pending.length === 0) return;
  const deadline = performance.now() + timeoutMs;
  await new Promise<void>((resolve) => {
    const poll = () => {
      if (pending.every((v) => v.readyState >= 2) || performance.now() >= deadline) {
        resolve();
        return;
      }
      setTimeout(poll, 50);
    };
    poll();
  });
}

interface RfcVideo {
  requestVideoFrameCallback: (callback: VideoFrameRequestCallback) => number;
  cancelVideoFrameCallback: (handle: number) => void;
}

/** Waits until a <video>'s async seek to `time` has completed, so a later
 *  drawImage shows the trimmed start instead of the pre-load poster. Resolves
 *  without waiting when the seek isn't actually needed or never lands within
 *  `timeoutMs`. */
export function waitForSeek(video: HTMLVideoElement, time: number, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    if (video.readyState === 0 || Math.abs(video.currentTime - time) < 0.001) {
      resolve();
      return;
    }
    let timer: ReturnType<typeof setTimeout> | 0 = 0;
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", done);
      resolve();
    };
    timer = setTimeout(done, timeoutMs);
    video.addEventListener("seeked", done);
  });
}

/** Waits until a <video> is actually displaying a decodable frame with non-zero
 *  dimensions, so drawImage returns real pixels instead of the black rectangle
 *  of an unpainted element. readyState >= 2 alone isn't enough: it can be
 *  satisfied by the position the element was pre-load-seeked to, before the
 *  frame at the current playhead has been presented. Prefers
 *  requestVideoFrameCallback, falling back to a short poll. */
export async function waitForPresentedFrame(video: HTMLVideoElement, timeoutMs = 3000): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  if (typeof (video as RfcVideo).requestVideoFrameCallback === "function") {
    await new Promise<void>((resolve) => {
      const onFrame = () => {
        const rfc = video as RfcVideo;
        if (typeof rfc.cancelVideoFrameCallback === "function") rfc.cancelVideoFrameCallback(handle);
        resolve();
      };
      const handle = (video as RfcVideo).requestVideoFrameCallback(onFrame);
      setTimeout(resolve, timeoutMs);
    });
    return;
  }
  await new Promise<void>((resolve) => {
    const poll = () => {
      if (performance.now() >= deadline || (video.readyState >= 2 && video.videoWidth > 0)) {
        resolve();
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}

/** Waits for playback to genuinely begin producing frames after play(). The
 *  first frames of a just-started video can be a blank/still poster while the
 *  decoder spins up; recording from that point would bake the blank head into
 *  the export. Resolves once currentTime advances meaningfully past `from`, or
 *  after `timeoutMs` (degrade to today's behavior for damaged inputs). */
export function waitForPlayback(
  video: HTMLVideoElement,
  from: number,
  timeoutMs = 600
): Promise<void> {
  return new Promise((resolve) => {
    // Date.now rather than performance.now: the capture loop reads
    // performance.now for its elapsed-time accounting, and extra consumers
    // would skew setups that stub it (wall-clock is fine for a 600ms cap).
    const deadline = Date.now() + timeoutMs;
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    const poll = () => {
      // Rate-check: once we're clearly past the starting position the clock is
      // ticking and real frames are being produced. A tiny margin keeps a
      // frozen-then-plays quirk from resolving prematurely. Paused is NOT a
      // success state — a video that hasn't begun the transition to playing is
      // still blank; only the timeout backstops that case.
      if (Math.abs(video.currentTime - from) > 0.06) {
        done();
        return;
      }
      // Enforce the deadline inside the chain itself: the outer timer only
      // resolves the promise — without this check a video that never plays
      // keeps re-arming 20 ms polls forever (timer leak per export).
      if (Date.now() >= deadline) {
        done();
        return;
      }
      setTimeout(poll, 20);
    };
    poll();
  });
}

export async function recordCanvasToWebm(
  scene: EditorScene,
  canvas: HTMLCanvasElement,
  media: HTMLVideoElement | HTMLImageElement | null,
  frameWidth: number | undefined,
  frameHeight: number | undefined,
  pixelRatio: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  layerMedias?: Map<string, CanvasImageSource | null>,
  frameOverlays?: Map<string, CanvasImageSource | null>,
  activeLayerId: string | null = scene.activeLayerId,
  signal?: AbortSignal
) {
  // Annotations are drawn from the scene automatically; the background image
  // must be preloaded and passed in (the canvas renderer is synchronous).
  const { overlay, backgroundImage, watermarkImage } = await loadExportAssets(scene);

  // Match the PNG export: the caller passes the frame box derived from pure
  // scene math so overlay skins (iphone15/16pro) keep their native aspect
  // ratio and output size never depends on the preview's on-screen layout.
  // MP4 (mpeg4) can't carry an alpha channel, so a transparent scene is
  // composited onto black for the video export (PNG keeps real transparency).
  const backgroundFill = scene.backgroundMode === "transparent" ? "#000000" : undefined;

  const fps = 30;
  // Attach the canvas to the DOM (off-screen) before capturing: some browsers
  // won't deliver frames from captureStream() on a detached canvas, which
  // yields an empty recording. A *zero* opacity is also risky: the compositor
  // may treat a fully transparent element as nothing to present and stall the
  // first frames the stream reports — the blank lead we're trying to banish.
  // A tiny non-zero opacity keeps the canvas composited (frames flow) while
  // remaining visually invisible.
  canvas.style.position = "fixed";
  canvas.style.left = "-9999px";
  canvas.style.top = "0";
  canvas.style.opacity = "0.004";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "-1";
  document.body.appendChild(canvas);

  // Resolve the active layer before stream setup so the audio capture branch
  // below can check its muted state.
  const activeForCapture = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  if (!activeForCapture) {
    canvas.remove();
    throw new Error("Cannot export a scene with no layers.");
  }

  // Draw a warm-up frame before creating the stream. Some GPU/compositor
  // pipelines won't deliver ANY frames to captureStream() when the canvas has
  // never been painted, which MediaRecorder would otherwise turn into an empty
  // blob (the "Recording produced no frames." guard below).
  try {
    renderMockupToCanvas(canvas, scene, activeForCapture?.hidden ? null : media, undefined, undefined, frameWidth, frameHeight, pixelRatio, { zoom: 1, offsetX: 0, offsetY: 0 }, backgroundFill, overlay, backgroundImage, layerMedias, frameOverlays, activeLayerId, watermarkImage);
  } catch {
    // The per-tick render runs again right after; a warm-up failure alone
    // must not abort the export.
  }

  let stream: MediaStream | null = null;
  let bgAudioEl: HTMLAudioElement | null = null;
  let bgAudioCtx: AudioContext | null = null;

  // Everything from stream setup onwards must run through the try/finally
  // below: a recorder error, an aborted capture or a render exception inside
  // the tick loop would otherwise leak the off-screen canvas, keep the
  // MediaStream tracks live and leave background music playing until reload.
  try {
    try {
      stream = canvas.captureStream(fps);
    } catch (err) {
      if (err instanceof DOMException && err.name === "SecurityError") {
        throw new Error("This video can't be exported: its host doesn't allow cross-origin capture. Use a file you uploaded instead.");
      }
      throw err;
    }

    // Background audio: if the user uploaded an audio track, capture it through
    // a gain node (so fade in/out can be applied) instead of any video-layer
    // audio (replaces, not mixes).
    let bgGain: GainNode | null = null;
    if (scene.backgroundAudioUrl) {
      try {
        bgAudioEl = document.createElement("audio");
        // crossOrigin before src — the CORS mode is captured at fetch start.
        bgAudioEl.crossOrigin = "anonymous";
        bgAudioEl.src = scene.backgroundAudioUrl;
        bgAudioEl.loop = true;
        await bgAudioEl.play();
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && typeof AudioContext !== "undefined") {
          // Route element → gain → destination so linear ramps shape the fades.
          bgAudioCtx = new AudioContext();
          // An AudioContext created outside a live user gesture starts
          // suspended; the fades then never run and the export is silent.
          if (bgAudioCtx.state === "suspended") await bgAudioCtx.resume().catch(() => undefined);
          const source = bgAudioCtx.createMediaElementSource(bgAudioEl);
          bgGain = bgAudioCtx.createGain();
          bgGain.gain.value = 1;
          const dest = bgAudioCtx.createMediaStreamDestination();
          source.connect(bgGain);
          bgGain.connect(dest);
          const fadeTracks = dest.stream.getAudioTracks();
          if (fadeTracks.length > 0) {
            stream = new MediaStream([videoTrack, ...fadeTracks]);
          }
        } else if (videoTrack) {
          const bgStream = (bgAudioEl as HTMLAudioElement & { captureStream: () => MediaStream }).captureStream();
          const bgTracks = bgStream.getAudioTracks();
          if (bgTracks.length > 0) {
            stream = new MediaStream([videoTrack, ...bgTracks]);
          }
        }
      } catch {
        // background audio not supported — export video-only
      }
    } else if (media instanceof HTMLVideoElement && activeForCapture.videoMuted === false) {
      try {
        const audioMs = (media as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream();
        const audioTracks = audioMs.getAudioTracks();
        if (audioTracks.length > 0) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            stream = new MediaStream([videoTrack, ...audioTracks]);
          }
        }
      } catch {
        // audio capture not supported — export video-only
      }
    }

    const chunks: BlobPart[] = [];
    const mimeType = chooseWebmMimeType();
    // A generous bitrate for the lossy VP8/VP9 intermediate. The webm is only a
    // stepping stone to the MP4, and the browser default is low, so re-encoding
    // a low-quality intermediate through H.264 can't recover the lost detail —
    // it just passes the blockiness along. Capture clean, let the final encode
    // set the real quality/size tradeoff.
    const intermediateBitsPerSecond = 16_000_000;
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: intermediateBitsPerSecond })
        : new MediaRecorder(stream);
    } catch {
      // Engines that can't record any requested WebM codec (e.g. Safari)
      // throw NotSupportedError from the constructor; fall back to the
      // browser's default recording format rather than failing the export.
      recorder = new MediaRecorder(stream);
    }
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const start = Math.max(0, activeForCapture.videoTrimStart || 0);
    const end = activeForCapture.videoTrimEnd > start ? activeForCapture.videoTrimEnd : activeForCapture.videoDuration;
    const isVideo = media instanceof HTMLVideoElement;
    const duration = computeCaptureDuration(scene, activeLayerId);

    const allVideos = [media, ...(layerMedias?.values() ?? [])].filter((m): m is HTMLVideoElement => m instanceof HTMLVideoElement);
    if (media instanceof HTMLVideoElement) {
      media.playbackRate = Math.max(0.5, Math.min(2, activeForCapture?.playbackSpeed ?? 1));
      media.muted = activeForCapture?.videoMuted !== false;
      // Seek to the trim start, then begin playback BEFORE the recorder starts:
      // MediaRecorder captures the live canvas stream the moment start() runs,
      // and anything painted before the video is playing/presented would land as
      // a blank frame at the head of the export.
      if (Math.abs(media.currentTime - start) > 0.001) media.currentTime = start;
      await waitForSeek(media, start);
      await media.play().catch(() => null);
      // Playback startup latency: wait until the clock is actually advancing
      // (poster frame ≠ playing frame) so the frame we render next is a real
      // frame and not the still blank poster.
      await waitForPlayback(media, start);
    }

    // Multi-frame scene: every frame-instance video is drawn simultaneously via
    // drawImage. Each must be past its own playback startup latency too, or the
    // shared poster/still frame lands as a blank head. Only then require a
    // presented frame. waiting from each video's *current* position confirms its
    // own clock is genuinely advancing, independent of per-layer trim values.
    const videos = allVideos as HTMLVideoElement[];
    await Promise.all(
      videos.map((v) => waitForPlayback(v, v.currentTime))
    );

    // Ensure every video source that will be drawn has presented a frame BEFORE
    // the recorder starts, so the recording doesn't open with blank/black
    // frames. drawImage of a video whose frame hasn't been presented renders a
    // black rectangle — the "black flash" at the head of video exports. Loading
    // is already kicked off by the caller; this only waits for it to land. The
    // cap keeps a damaged file from hanging the export — it degrades to today's
    // head-black output.
    await Promise.all(allVideos.map((v) => waitForPresentedFrame(v)));

    // Paint the prepared media again so the recorder's very first captured
    // frame reflects the now-presented video, not the pre-play warm-up draw.
    // The recorder's first chunk reflects whatever the capture stream last
    // sampled. Frame sampling runs on its own cadence (~1000/fps ms), so a
    // freshly-painted canvas can be missed until the next sample — leaving
    // the blank pre-media warm-up in the opening frames. 'requestFrame()'
    // patches this on Chromium; a settle-wait of one sampling period is the
    // portable equivalent (Safari/Firefox) that guarantees the recorder
    // starts reading a canvas that already shows the media.
    try {
      const sampled = sampleVideoTransform(activeForCapture ?? scene.layers[0], 0);
      const transform: RenderTransform = { zoom: sampled.zoom, offsetX: sampled.x, offsetY: sampled.y };
      renderMockupToCanvas(canvas, scene, activeForCapture?.hidden ? null : media, undefined, undefined, frameWidth, frameHeight, pixelRatio, transform, backgroundFill, overlay, backgroundImage, layerMedias, frameOverlays, activeLayerId, watermarkImage);
    } catch {
      // A render exception is still caught by the tick loop; don't abort here.
    }
    // Force the freshly-painted frame into the capture stream immediately.
    // Chromium-only: CanvasCaptureMediaStreamTrack.requestFrame() reads the
    // canvas bitmap straight away. On engines without it this is a no-op, so
    // the settle-wait below is what actually guarantees a non-blank head.
    if (stream && typeof stream.getVideoTracks === "function") {
      const frameTrack = stream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
      frameTrack?.requestFrame?.();
    }
    // One full sampling period guarantees the capture stream has already
    // taken a frame of the freshly-painted canvas before the recorder's
    // first chunk is opened. A plain timer is more robust than rAF here:
    // it fires even in a hidden/throttled tab and can't resolve early,
    // before the sampler at 1000/fps cadence has seen the paint.
    await new Promise<void>((resolve) => setTimeout(resolve, Math.ceil(1000 / fps) + 32));

    await new Promise<void>((resolve, reject) => {
      let raf = 0;
      let bgTimer: ReturnType<typeof setTimeout> | null = null;
      const fail = (err: unknown) => {
        cancelAnimationFrame(raf);
        if (bgTimer) clearTimeout(bgTimer);
        try {
          recorder.stop();
        } catch {
          // never started
        }
        reject(err);
      };
      recorder.onstop = () => resolve();
      recorder.onerror = () => fail(new Error("MediaRecorder failed"));
      // Schedule the background-audio fades against the recording timeline:
      // linear ramp from silence after start, and to silence before the end.
      if (bgGain && bgAudioCtx) {
        const t0 = bgAudioCtx.currentTime;
        const durationSec = Math.max(0.1, duration);
        const fadeIn = Math.max(0, Math.min(durationSec / 2, scene.audioFadeIn || 0));
        const fadeOut = Math.max(0, Math.min(durationSec / 2, scene.audioFadeOut || 0));
        if (fadeIn > 0) {
          bgGain.gain.setValueAtTime(0.0001, t0);
          bgGain.gain.linearRampToValueAtTime(1, t0 + fadeIn);
        }
        if (fadeOut > 0) {
          bgGain.gain.setValueAtTime(1, t0 + Math.max(fadeIn, durationSec - fadeOut));
          bgGain.gain.linearRampToValueAtTime(0.0001, t0 + durationSec);
        }
      }
      recorder.start(200);

      const startedAt = performance.now();

      // rAF pauses entirely while the tab is hidden, which would stall the
      // stop conditions and balloon the recording with frozen frames until
      // the user refocuses. Timers keep firing (throttled), so hidden tabs
      // fall back to a timer-driven loop; the ticking flag guards re-entry.
      let ticking = false;
      const isHidden = () => typeof document !== "undefined" && document.hidden === true;

      const clearPending = () => {
        cancelAnimationFrame(raf);
        if (bgTimer) {
          clearTimeout(bgTimer);
          bgTimer = null;
        }
      };

      const scheduleNext = () => {
        if (isHidden()) {
          bgTimer = setTimeout(runTick, 250);
        } else {
          raf = requestAnimationFrame(runTick);
        }
      };

      const tick = () => {
        try {
          clearPending();
          ticking = false;
          // Cancellation is checked every frame so cancelling mid-recording
          // actually stops the capture.
          if (signal?.aborted) {
            if (media instanceof HTMLVideoElement) media.pause();
            fail(new DOMException("Export cancelled", "AbortError"));
            return;
          }
          const elapsed = (performance.now() - startedAt) / 1000;
          const normalized = duration > 0 ? Math.min(1, elapsed / duration) : 1;
          const progress = Math.min(100, normalized * 100);
          const sampled = sampleVideoTransform(activeForCapture ?? scene.layers[0], normalized);
          const transform: RenderTransform = { zoom: sampled.zoom, offsetX: sampled.x, offsetY: sampled.y };
          onProgress?.(progress);

          if (isVideo) {
            // Guard against a not-yet-measured duration (end undefined/0): only
            // stop on the video's playhead when we actually know where it ends.
            const stopAt = typeof end === "number" && isFinite(end) && end > 0 ? end : Infinity;
            if (media.currentTime >= stopAt || elapsed >= duration) {
              media.pause();
              renderMockupToCanvas(canvas, scene, activeForCapture?.hidden ? null : media, undefined, undefined, frameWidth, frameHeight, pixelRatio, transform, backgroundFill, overlay, backgroundImage, layerMedias, frameOverlays, activeLayerId, watermarkImage);
              recorder.stop();
              onProgress?.(100);
              return;
            }
          } else if (elapsed >= duration) {
            recorder.stop();
            onProgress?.(100);
            return;
          }

          renderMockupToCanvas(canvas, scene, activeForCapture?.hidden ? null : media, undefined, undefined, frameWidth, frameHeight, pixelRatio, transform, backgroundFill, overlay, backgroundImage, layerMedias, frameOverlays, activeLayerId, watermarkImage);
          scheduleNext();
        } catch (err) {
          // A render exception must not leave the promise pending forever with
          // the recorder running and everything leaked.
          if (media instanceof HTMLVideoElement) media.pause();
          fail(err);
        }
      };

      const runTick = () => {
        if (ticking) return;
        ticking = true;
        tick();
      };

      onStatus?.("Recording preview…");
      scheduleNext();
    });

    return new Blob(chunks, { type: recorder.mimeType || "video/webm" });
  } finally {
    canvas.remove();
    // Free the capture stream's tracks so the canvas track doesn't leak between
    // exports, and tear down the audio graph.
    stream?.getTracks().forEach((track) => track.stop());
    if (bgAudioCtx) {
      try {
        void bgAudioCtx.close();
      } catch {
        // already closed
      }
    }
    if (bgAudioEl) {
      bgAudioEl.pause();
      bgAudioEl.remove();
    }
  }
}
