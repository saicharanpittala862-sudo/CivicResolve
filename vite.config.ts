import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "client"),
  plugins: [react(), tailwindcss()],
  build: { outDir: path.resolve(import.meta.dirname, "dist/public"), emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": "http://localhost:3000" } },
  test: {
    root: path.resolve(import.meta.dirname),
    include: ["server/**/*.test.ts"],
    env: { DATABASE_PATH: ":memory:", JWT_SECRET: "test-secret-test-secret-test-secret", STORAGE_DIR: "./data/test-uploads" },
  },
});
