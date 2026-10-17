import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'apps',
  base: './',
  publicDir: '../public',
  server: { port: 5187, strictPort: true },
  preview: { port: 4187, strictPort: true },
  build: {
    outDir: '../dist/site',
    emptyOutDir: true,
    rollupOptions: {
      input: { site: resolve('apps/index.html'), lab: resolve('apps/lab/index.html') },
    },
  },
});
