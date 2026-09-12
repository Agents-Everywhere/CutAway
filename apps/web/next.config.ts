import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ["agent-core", "cutaway-core"],
  turbopack: { root: resolve(import.meta.dirname, "../..") },
  distDir: process.env.CUTAWAY_NEXT_DIST || ".next",
};

export default nextConfig;
