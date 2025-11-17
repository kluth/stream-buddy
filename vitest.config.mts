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
    transformMode: {
      web: [/node_modules/],
    },
    esm: true,
    deps: {
      inline: true,
      interopDefault: true,
      moduleDirectories: ['node_modules'],
      fallbackCJS: true,
    },
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
}));
