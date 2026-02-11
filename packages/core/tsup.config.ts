import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "contracts/index": "src/contracts/index.ts",
    "engine/index": "src/engine/index.ts",
    "adapters/index": "src/adapters/index.ts",
    "sources/index": "src/sources/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: false, // Disable tree-shaking to preserve all exports
});
