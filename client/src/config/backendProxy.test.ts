import { afterEach, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";

afterEach(() => vi.unstubAllEnvs());

it.each([
  ["documented server URL", "http://127.0.0.1:18090", undefined, "http://127.0.0.1:18090"],
  ["TV1 alias", undefined, "http://127.0.0.1:18091", "http://127.0.0.1:18091"],
  ["documented URL takes precedence", "http://127.0.0.1:18090", "http://127.0.0.1:18091", "http://127.0.0.1:18090"],
  ["local default", undefined, undefined, "http://127.0.0.1:8080"],
  ["documented URL with trailing slash", "http://127.0.0.1:18090/", undefined, "http://127.0.0.1:18090"],
  ["alias with trailing slash", undefined, "http://127.0.0.1:18091/", "http://127.0.0.1:18091"],
] as const)("routes all supported REST endpoints using %s", async (_name, documentedUrl, aliasUrl, expected) => {
  vi.stubEnv("HUYENCO_API_URL", documentedUrl);
  vi.stubEnv("API_SERVER_URL", aliasUrl);
  expect(await nextConfig.rewrites!()).toEqual([
    { source: "/api/v1/hexagrams/:path*", destination: `${expected}/api/v1/hexagrams/:path*` },
    { source: "/api/v1/calendar/convert", destination: `${expected}/api/v1/calendar/convert` },
    { source: "/api/v1/calendar/can-chi", destination: `${expected}/api/v1/calendar/can-chi` },
    { source: "/api/v1/session", destination: `${expected}/api/v1/session` },
    { source: "/api/v1/history/:path*", destination: `${expected}/api/v1/history/:path*` },
  ]);
});

// Next rewrites are method-independent. Exercise its installed matcher rather
// than assuming that the :path* pattern accepts a collection's bare URL.
it.each([
  ["GET", "/api/v1/hexagrams", "/api/v1/hexagrams/:path*"],
  ["GET", "/api/v1/hexagrams/H_KHAM_TON", "/api/v1/hexagrams/:path*"],
  ["POST", "/api/v1/calendar/convert", "/api/v1/calendar/convert"],
  ["POST", "/api/v1/calendar/can-chi", "/api/v1/calendar/can-chi"],
  ["POST", "/api/v1/session", "/api/v1/session"],
  ["GET", "/api/v1/history", "/api/v1/history/:path*"],
  ["POST", "/api/v1/history", "/api/v1/history/:path*"],
  ["GET", "/api/v1/history/905b2f9f-c230-4887-9369-7b5500964f59", "/api/v1/history/:path*"],
  ["DELETE", "/api/v1/history/905b2f9f-c230-4887-9369-7b5500964f59", "/api/v1/history/:path*"],
] as const)("matches %s %s through the intended rewrite", async (_method, path, source) => {
  const rewrites = await nextConfig.rewrites!();
  if (!Array.isArray(rewrites)) throw new Error("Expected a flat rewrite list");
  expect(rewrites.filter(rewrite => getPathMatch(rewrite.source)(path) !== false).map(rewrite => rewrite.source)).toEqual([source]);
});
