import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});

