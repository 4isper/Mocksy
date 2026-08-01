"use client";

/** Triggers a browser download for the given blob. The object URL is revoked
 *  shortly after the click so the browser finishes the download. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}
