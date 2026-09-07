import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    env: {
      PGLITE_MEMORY: "true",
      ALLOW_EXTERNAL_SEND: "false",
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
