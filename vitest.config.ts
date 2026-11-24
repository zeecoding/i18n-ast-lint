import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@locale-lint/core": resolve(__dirname, "packages/core/src/index.ts"),
    },
  },
  test: {
    include: [
      "packages/**/tests/**/*.test.ts",
    ],
    benchmark: {
      include: [
        "packages/**/tests/**/*.bench.ts",
      ],
    },
    globals: false,
    environment: "node",
  },
});
