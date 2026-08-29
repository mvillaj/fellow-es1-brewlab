import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // @brewlab/shared is a workspace package consumed as TypeScript source, so it
  // must go through Vite's transform rather than the dependency pre-bundler.
  optimizeDeps: { exclude: ['@brewlab/shared'] },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.API_URL ?? 'http://localhost:4000', changeOrigin: true },
    },
  },
});
