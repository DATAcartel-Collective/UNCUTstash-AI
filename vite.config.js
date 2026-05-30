// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ["@electric-sql/pglite", "@mlc-ai/web-llm"],
  },
  worker: {
    format: "es",
  },
  server: {
    port: 5173,
    strictPort: false, // Allows Vite to automatically find the next open port
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  build: {
    rollupOptions: {
      external: ['fs', 'path', 'url'],
    }
  }
});