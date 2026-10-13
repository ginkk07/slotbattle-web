import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const pagesRoot = fileURLToPath(new URL("./pages", import.meta.url));
const publicDir = fileURLToPath(new URL("./public", import.meta.url));
const outputDir = fileURLToPath(new URL("./dist-pages", import.meta.url));

export default defineConfig({
  root: pagesRoot,
  base: "/slotbattle-web/",
  publicDir,
  plugins: [react()],
  build: {
    outDir: outputDir,
    emptyOutDir: true,
  },
});
