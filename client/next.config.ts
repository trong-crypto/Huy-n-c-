import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  // Same-origin, read-only lookup proxy. No session/history endpoints are proxied here.
  async rewrites() {
    const server = (process.env.API_SERVER_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
    return [{ source: "/api/v1/hexagrams/:path*", destination: `${server}/api/v1/hexagrams/:path*` }];
  },
};

export default nextConfig;

