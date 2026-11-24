import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: {
      resolve: ["@locale-lint/core"],
    },
    clean: true,
    treeshake: true,
    sourcemap: true,
    target: "node18",
    noExternal: ["@locale-lint/core"],
    external: ["typescript", "jsonc-parser", "cac", "tinyglobby"],
    outExtension({ format }) {
      return {
        js: format === "esm" ? ".mjs" : ".cjs",
      };
    },
  },
  {
    entry: ["src/bin.ts"],
    format: ["esm"],
    dts: false,
    clean: false,
    treeshake: true,
    sourcemap: true,
    target: "node18",
    noExternal: ["@locale-lint/core"],
    external: ["typescript", "jsonc-parser", "cac", "tinyglobby"],
    banner: {
      js: "#!/usr/bin/env node",
    },
    outExtension() {
      return {
        js: ".mjs",
      };
    },
  },
]);
