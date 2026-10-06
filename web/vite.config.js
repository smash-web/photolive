import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// three / mind-ar-image-three / mind-ar-image НЕ устанавливаются через npm —
// они подключены в index.html через <script type="importmap"> и грузятся
// из CDN прямо в браузере. Поэтому Vite не должен пытаться их собирать —
// помечаем их как "external", чтобы import-выражения в коде остались
// как есть и браузер сам разрешил их через importmap во время выполнения.
const EXTERNAL_PREFIXES = ["three", "mind-ar-image-three", "mind-ar-image"];
const isExternal = (id) => EXTERNAL_PREFIXES.some((p) => id === p || id.startsWith(p + "/"));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: isExternal,
    },
  },
  optimizeDeps: {
    exclude: EXTERNAL_PREFIXES,
  },
});
