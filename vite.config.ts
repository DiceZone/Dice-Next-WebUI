import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), {
    name: 'third-party-notices',
    generateBundle() {
      for (const file of ['Tremor-LICENSE.txt', 'shadcn-LICENSE.txt', 'README.md']) {
        this.emitFile({ type: 'asset', fileName: `licenses/${file}`,
          source: readFileSync(new URL(`./THIRD_PARTY/${file}`, import.meta.url), 'utf8') });
      }
    },
  }],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:18088',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:18088',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Always bust cache with content hash
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        hashCharacters: 'hex',
      },
    },
  },
});
