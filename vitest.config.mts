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
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    deps: {
      moduleDirectories: ['node_modules'],
    },
  },
  define: {
    'import.meta.vitest': undefined,
  },
  resolve: {
    alias: {
      '@app/': new URL('./src/app/', import.meta.url).pathname,
      '@env/': new URL('./src/environments/', import.meta.url).pathname,
      '@angular/core': '@angular/core/fesm2022/core.mjs',
      '@angular/core/testing': '@angular/core/fesm2022/testing.mjs',
      '@angular/common/testing': '@angular/common/fesm2022/testing.mjs',
      '@angular/platform-browser/testing': '@angular/platform-browser/fesm2022/testing.mjs',
      '@angular/platform-browser-dynamic/testing': '@angular/platform-browser-dynamic/fesm2022/testing.mjs',
    },
  },
  optimizeDeps: {
    include: [
      '@angular/core',
      '@angular/core/testing',
      '@angular/common/testing',
      '@angular/platform-browser/testing',
      '@angular/platform-browser-dynamic/testing',
      'jsdom',
      'parse5',
    ],
    interopDefault: true,
  },
  test: {
    server: {
      deps: {
        inline: ['jsdom', 'parse5', '@angular/core'],
      },
    },
  },
}));