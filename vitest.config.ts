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
    include: ["tests/**/*.test.ts"],
    // Placeholder until browser tests are added in Phase 5.
    exclude: ["tests/web/smoke.test.ts"]
  }
});
