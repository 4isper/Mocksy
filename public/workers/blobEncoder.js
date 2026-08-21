/**
 * Blob-encoding worker: receives an ImageBitmap (transferred, zero-copy),
 * draws it onto an OffscreenCanvas and encodes it to PNG/WebP off the main
 * thread. Large exports (2×/4×) spend most of their time inside the PNG
 * encoder, so moving that step keeps the editor responsive.
 *
 * Plain JS on purpose — it is served as a static asset from /public and never
 * goes through the bundler (same approach as the generated service worker).
 */
self.onmessage = async (event) => {
  const { id, bitmap, mimeType, quality } = event.data || {};
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: mimeType, quality });
    self.postMessage({ id, blob });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
