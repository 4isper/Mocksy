import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude ffmpeg from server bundle
      if (!Array.isArray(config.externals)) {
        config.externals = [config.externals || {}];
      }
      config.externals.push({
        "@ffmpeg/ffmpeg": "@ffmpeg/ffmpeg",
        "@ffmpeg/util": "@ffmpeg/util"
      });
    }
    return config;
  }
};

export default nextConfig;
