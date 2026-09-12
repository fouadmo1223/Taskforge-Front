/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@flowdesk/types': fileURLToPath(new URL('../../packages/types/src/index.ts', import.meta.url)),
      '@flowdesk/utils': fileURLToPath(new URL('../../packages/utils/src/index.ts', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split slow-changing vendor code into cacheable groups so an app
        // deploy doesn't bust the whole bundle.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'vendor-editor';
          if (id.includes('@dnd-kit')) return 'vendor-dnd';
          if (/[\\/]node_modules[\\/]motion/.test(id) || id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('i18next')) return 'vendor-i18n';
          if (/[\\/]node_modules[\\/]date-fns[\\/]/.test(id)) return 'vendor-datefns';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
