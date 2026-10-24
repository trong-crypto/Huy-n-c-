import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Unit tests need JSX transformation, not Fast Refresh or Babel plugins.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    // Leave the runner's Date/performance clock real on Node 20.9 as well.
    fakeTimers: { toFake: ["setTimeout", "clearTimeout"] },
  },
});
