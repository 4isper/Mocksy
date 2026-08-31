"use client";

/** Triggers a browser download for the given blob. The object URL is revoked
 *  after a grace period so slow handoffs of large blobs (batch ZIPs can be
 *  hundreds of MB) still complete — browsers take a reference at click time,
 *  but revoking too aggressively can abort the download on some engines.
 *  Matches the 5 s grace the MP4/GIF exporters use. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
