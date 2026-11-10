import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.HUYENCO_NEXT_DIST_DIR ?? ".next",
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  // Same-origin E02/C01 and H01; the Backend retains all Origin/CSRF/owner checks.
  async rewrites() {
    const server = (process.env.HUYENCO_API_URL ?? process.env.API_SERVER_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
    return [
      ...(process.env.HUYENCO_WS_PROXY === "1" ? [{ source: "/ws", destination: `${server}/ws` }] : []),
      ...(process.env.NEXT_PUBLIC_ACCOUNT_HISTORY === "1" ? [
        { source: "/api/v1/ws", destination: `${server}/api/v1/ws` },
        { source: "/api/v1/ws/chat", destination: `${server}/api/v1/ws/chat` },
        { source: "/api/v1/chat/consultants/:path*", destination: `${server}/api/v1/chat/consultants/:path*` },
        { source: "/api/v1/chat/conversations/:path*", destination: `${server}/api/v1/chat/conversations/:path*` },
        { source: "/api/v1/ai/:path*", destination: `${server}/api/v1/ai/:path*` },
      ] : []),
      ...(process.env.NEXT_PUBLIC_ACCOUNT_HISTORY === "1" || process.env.NEXT_PUBLIC_METHOD_GUIDES === "1"
        || process.env.NEXT_PUBLIC_ADMIN_ACCOUNTS === "1" || process.env.NEXT_PUBLIC_ADMIN_HEXAGRAM_GLOSSES === "1"
        || process.env.NEXT_PUBLIC_ADMIN_SOURCE_CATALOG === "1" || process.env.NEXT_PUBLIC_WEBSITE_CONTENT === "1"
        || process.env.NEXT_PUBLIC_HEXAGRAM_INTERPRETATIONS === "1" ? [
        { source: "/api/v1/auth/:path*", destination: `${server}/api/v1/auth/:path*` },
      ] : []),
      ...(process.env.NEXT_PUBLIC_WEBSITE_CONTENT === "1" ? [
        { source: "/api/v1/admin/website-content/:path*", destination: `${server}/api/v1/admin/website-content/:path*` },
        { source: "/api/v1/website-content", destination: `${server}/api/v1/website-content` },
      ] : []),
      ...(process.env.NEXT_PUBLIC_ADMIN_SOURCE_CATALOG === "1" ? [
        { source: "/api/v1/admin/sources/:path*", destination: `${server}/api/v1/admin/sources/:path*` },
      ] : []),
      ...(process.env.NEXT_PUBLIC_ADMIN_HEXAGRAM_GLOSSES === "1" || process.env.NEXT_PUBLIC_HEXAGRAM_INTERPRETATIONS === "1" ? [
        { source: "/api/v1/admin/hexagrams/:path*", destination: `${server}/api/v1/admin/hexagrams/:path*` },
      ] : []),
      ...(process.env.NEXT_PUBLIC_METHOD_GUIDES === "1" ? [
        { source: "/api/v1/admin/method-guides/:path*", destination: `${server}/api/v1/admin/method-guides/:path*` },
        { source: "/api/v1/method-guides", destination: `${server}/api/v1/method-guides` },
      ] : []),
      ...(process.env.NEXT_PUBLIC_ADMIN_ACCOUNTS === "1" ? [
        { source: "/api/v1/admin/accounts/:path*", destination: `${server}/api/v1/admin/accounts/:path*` },
        { source: "/api/v1/admin/consultants/:path*", destination: `${server}/api/v1/admin/consultants/:path*` },
        { source: "/api/v1/admin/metrics", destination: `${server}/api/v1/admin/metrics` },
        { source: "/api/v1/admin/audit", destination: `${server}/api/v1/admin/audit` },
      ] : []),
      { source: "/api/v1/hexagrams/:path*", destination: `${server}/api/v1/hexagrams/:path*` },
      { source: "/api/v1/calendar/convert", destination: `${server}/api/v1/calendar/convert` },
      { source: "/api/v1/calendar/can-chi", destination: `${server}/api/v1/calendar/can-chi` },
      { source: "/api/v1/session", destination: `${server}/api/v1/session` },
      { source: "/api/v1/history/:path*", destination: `${server}/api/v1/history/:path*` },
    ];
  },
};

export default nextConfig;

