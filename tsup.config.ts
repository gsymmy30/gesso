import { defineConfig } from "tsup";
import { cpSync } from "node:fs";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  outExtension: () => ({ js: ".mjs" }),
  onSuccess: async () => {
    // Copy non-JS assets that are loaded at runtime via import.meta.url
    cpSync("src/assets", "dist/assets", { recursive: true });
    cpSync("src/templates/archetypes", "dist/templates/archetypes", { recursive: true, filter: (src) => !src.endsWith(".ts") });
  },
});
