import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // PWA optimizations
    optimizePackageImports: ["@bantayog/web"],
  },
  // Output as standalone for PWA deployment
  output: "standalone",
};

export default nextConfig;
