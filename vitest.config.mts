/// <reference types="vitest" />
import { defineConfig } from 'vite';
import analog from '@analogjs/vite-plugin-angular';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [analog({
    tsconfig: 'src/tsconfig.spec.json',
    include: ['src/**/*.spec.ts', 'src/**/*.d.ts']
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
        '@angular/core': '@angular/core/fesm2022/core.mjs',
      },
    },
    optimizeDeps: {
      include: ['@angular/core', '@angular/core/testing', '@angular/common/testing', '@angular/platform-browser/testing'],
      globals: ['@angular/core'],
    },
  }));
