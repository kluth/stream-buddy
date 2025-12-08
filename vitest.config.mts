/// <reference types="vitest" />
import { defineConfig } from 'vite';
import analog from '@analogjs/vite-plugin-angular';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [analog()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    deps: {
      inline: ['jsdom'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['html', 'text-summary', 'lcov', 'text', 'json'],
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        'src/testing/**/*.ts',
        '**/*.spec.ts',
        '**/*.config.ts',
        '**/*.d.ts',
        '**/index.ts',
        '**/main.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
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
