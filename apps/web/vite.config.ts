import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The engine worker is an ES module so the WASM glue can use import.meta.url.
  worker: { format: "es" },
  server: {
    port: 5173,
    strictPort: true
  }
});
