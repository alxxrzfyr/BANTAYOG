import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  scope: "/",
  // Serwist doesn't support Turbopack (Next.js 16 default in dev).
  // Only enable the service worker plugin in production builds.
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  async rewrites() {
    let apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "http://localhost:3001";
    if (!apiBaseUrl.startsWith("http://") && !apiBaseUrl.startsWith("https://")) {
      apiBaseUrl = "https://" + apiBaseUrl;
    }
    return [
      { source: '/api/:path*', destination: `${apiBaseUrl}/api/:path*` },
    ];
  },
};

export default withSerwist(nextConfig);
