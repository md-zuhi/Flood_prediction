import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5007,
    proxy: { "/api": "http://localhost:7000" },
  },
});
