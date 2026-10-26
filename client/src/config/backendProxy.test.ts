import { afterEach, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";

afterEach(() => vi.unstubAllEnvs());

it.each([
  ["documented server URL", "http://127.0.0.1:18090", undefined, "http://127.0.0.1:18090"],
  ["TV1 alias", undefined, "http://127.0.0.1:18091", "http://127.0.0.1:18091"],
  ["documented URL takes precedence", "http://127.0.0.1:18090", "http://127.0.0.1:18091", "http://127.0.0.1:18090"],
  ["local default", undefined, undefined, "http://127.0.0.1:8080"],
  ["documented URL with trailing slash", "http://127.0.0.1:18090/", undefined, "http://127.0.0.1:18090"],
  ["alias with trailing slash", undefined, "http://127.0.0.1:18091/", "http://127.0.0.1:18091"],
] as const)("routes only hexagram lookups using %s", async (_name, documentedUrl, aliasUrl, expected) => {
  vi.stubEnv("HUYENCO_API_URL", documentedUrl);
  vi.stubEnv("API_SERVER_URL", aliasUrl);
  expect(await nextConfig.rewrites!()).toEqual([
    { source: "/api/v1/hexagrams/:path*", destination: `${expected}/api/v1/hexagrams/:path*` },
  ]);
});
