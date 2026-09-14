import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const basePath = process.env.BASE_PATH || '/myats-instagram-video/';
const port = Number(process.env.PORT || 24115);

export default defineConfig({
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
  },
});