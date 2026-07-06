import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist-mobile',
    emptyOutDir: true,
    sourcemap: true,
    target: 'esnext',
    lib: {
      entry: path.resolve(__dirname, 'src/content/mobile-entry.js'),
      name: 'DressAppMobileFloater',
      fileName: () => 'dressapp-mobile-floater.js',
      formats: ['iife'],
    },
    rollupOptions: {
      external: [],
      output: {
        extend: true,
      },
    },
  },
});
