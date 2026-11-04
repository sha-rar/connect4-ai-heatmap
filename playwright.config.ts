import { defineConfig, devices } from "@playwright/test";

// Browser tests run against the production build of the web app (vite
// preview), which is the standalone build that ships: the C++ engine runs as
// WebAssembly in a Web Worker, with no API server.
const PORT = 4173;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "tests/e2e/.results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never", outputFolder: "tests/e2e/.report" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm --filter @connect4/web build && pnpm --filter @connect4/web exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
