import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
