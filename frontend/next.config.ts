import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browser smoke checks use the loopback IP; keep the development allowlist narrow.
  allowedDevOrigins: ['127.0.0.1'],
  // Isolate verification builds from an already running development server.
  distDir: process.env.ATLAS_NEXT_DIST_DIR || '.next',
};

export default nextConfig;
