/** Minimal shape of a DataTransfer (or clipboard event's clipboardData) so the
 *  extraction logic below stays pure and unit-testable without DOM events. */
export interface ClipboardPayload {
  files?: FileList | File[] | null;
  /** Mirrors DataTransfer.getData("text/plain"). */
  getText?: (type: string) => string;
}

export type ClipboardMedia =
  | { kind: "file"; file: File }
  | { kind: "url"; url: string }
  | null;

const HTTP_URL = /^https?:\/\//i;

/** Picks the media payload from a paste/clipboard snapshot: the first file
 *  (screenshot, copied image/video file) wins; otherwise a plain-text http(s)
 *  URL is offered for remote loading. Null when neither is present. */
export function pickClipboardMedia(payload: ClipboardPayload | null | undefined): ClipboardMedia {
  const file = payload?.files?.[0];
  if (file) return { kind: "file", file };
  const text = payload?.getText?.("text/plain")?.trim();
  if (text && HTTP_URL.test(text)) return { kind: "url", url: text };
  return null;
}
