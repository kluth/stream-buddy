/// <reference types="vitest" />
import { defineConfig } from 'vite';
import analog from '@analogjs/vite-plugin-angular';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [analog({
    tsconfig: 'src/tsconfig.spec.json'
  })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    esm: true,
  },
  define: {
    'import.meta.vitest': undefined,
  },
  resolve: {
    alias: {
      '@testing': '/src/testing',
      '@app': '/src/app',
    },
  },
  optimizeDeps: {
    include: ['@angular/core', '@angular/core/testing', '@angular/common/testing', '@angular/platform-browser/testing'],
  },
  ssr: {
    noExternal: true,
  },
}));
