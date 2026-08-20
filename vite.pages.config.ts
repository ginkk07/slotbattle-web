import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pagesRoot = new URL("./pages", import.meta.url).pathname;
const publicDir = new URL("./public", import.meta.url).pathname;
const outputDir = new URL("./dist-pages", import.meta.url).pathname;

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
