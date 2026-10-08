import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: [resolve(root, "..")] },
  },
  preview: { port: 4173 },
  build: { chunkSizeWarningLimit: 1500 },
});
