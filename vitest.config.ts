import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Cross-package tests under tests/. Package-local tests run via `pnpm -r test`.
export default defineConfig({
  resolve: {
    alias: {
      "@connect4/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    // Browser tests (tests/e2e/*.spec.ts) run with Playwright instead.
    include: ["tests/**/*.test.ts"]
  }
});
