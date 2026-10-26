import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  // Same-origin E02 GET and C01 read-only POST. No session/history endpoints.
  async rewrites() {
    const server = (process.env.API_SERVER_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
    return [
      { source: "/api/v1/hexagrams/:path*", destination: `${server}/api/v1/hexagrams/:path*` },
      { source: "/api/v1/calendar/convert", destination: `${server}/api/v1/calendar/convert` },
      { source: "/api/v1/calendar/can-chi", destination: `${server}/api/v1/calendar/can-chi` },
    ];
  },
};

export default nextConfig;

