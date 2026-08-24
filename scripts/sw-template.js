/**
 * Mocksy PWA Service Worker — template.
 * scripts/generate-sw.mjs stamps __SW_VERSION__ into a build-time cache version
 * and writes the result to public/sw.js. Do not edit public/sw.js directly;
 * edit this template and run `npm run build` (or `node scripts/generate-sw.mjs`).
 * Strategy: navigation = network-first, Next.js chunks = network-first + background cache update,
 * immutable static assets + AI runtime CDN (jsdelivr) = stale-while-revalidate.
 * Using a versioned cache name so activate purges stale chunks on every deploy.
 */
const CACHE = "mocksy-sw-__SW_VERSION__";

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

/**
 * Whether a URL is a Next.js static chunk that must never be cache-first.
 * These files carry a content hash and change on every build.
 */
function isNextJsChunk(url) {
  return url.pathname.startsWith("/_next/static/");
}

/**
 * Whether a URL is a long-lived static asset (fonts, icons) that is safe
 * to use a stale-while-revalidate strategy.
 */
function isImmutableAsset(url) {
  return url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/icon") || url.pathname === "/manifest.json";
}

/**
 * Cross-origin CDNs that host the on-device AI runtime. transformers.js caches
 * model weights itself via the Cache API, but the ONNX Runtime wasm binaries
 * (~25 MB) are fetched straight from jsdelivr by ort-web and would fail
 * offline without this entry. Served stale-while-revalidate like immutable
 * assets: versioned npm URLs never change content once published.
 */
function isRuntimeCdnAsset(url) {
  return url.hostname === "cdn.jsdelivr.net";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and unlisted cross-origin requests.
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin && !isRuntimeCdnAsset(url)) return;

  // Navigation requests (HTML pages): network-first, fallback to cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, clone));
        return res;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Next.js static chunks: network-first, update cache in background.
  // Using cache-first here causes runtime failures after a deploy because
  // stale hashed chunks don’t match the new HTML entrypoint.
  if (isNextJsChunk(url)) {
    event.respondWith(
      fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return res;
      }).catch(() => caches.match(request).then((cached) => {
        if (cached) return cached;
        return new Response(null, { status: 408 });
      }))
    );
    return;
  }

  // Immutable assets (fonts, icons) and the AI runtime CDN: stale-while-revalidate.
  if (isImmutableAsset(url) || isRuntimeCdnAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        }).catch(() => cached ?? new Response(null, { status: 408 }));
        return cached ?? fetchPromise;
      })
    );
    return;
  }

  // Fallback for everything else (e.g. uploaded media): network only.
  return;
});
