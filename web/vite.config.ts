import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 開発時はAPI(/api)をローカルWorkerへ転送する
      "/api": "http://localhost:8787",
    },
  },
});
