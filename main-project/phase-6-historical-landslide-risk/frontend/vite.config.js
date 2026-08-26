import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5006,
    proxy: {
      '/api': 'http://localhost:6000',
    },
  },
});
