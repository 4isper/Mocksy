import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** Content-Security-Policy tuned to what the editor actually loads:
 *  - 'unsafe-inline' scripts: Next.js injects its bootstrap inline without
 *    nonces; everything else stays same-origin.
 *  - wasm-unsafe-eval: FFmpeg's self-hosted core (/ffmpeg-core.wasm).
 *  - blob: workers: off-thread PNG encode + the ffmpeg worker.
 *  - data:/blob: media: every asset is a data URL by design.
 *  - http(s) connect-src: user-pasted remote media is fetched client-side
 *    (loadMediaFromUrl) and re-encoded into a data URL.
 *  Dev additionally gets 'unsafe-eval' for Next.js HMR. */
function csp(): string {
  const dev = process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${dev}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' data: blob: http: https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ].join("; ");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp() }
        ]
      }
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude ffmpeg from server bundle
      if (!Array.isArray(config.externals)) {
        config.externals = [config.externals || {}];
      }
      config.externals.push({
        "@ffmpeg/ffmpeg": "@ffmpeg/ffmpeg"
      });
    }
    return config;
  }
};

export default withNextIntl(nextConfig);
