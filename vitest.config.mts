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
  },
  define: {
    'import.meta.vitest': undefined,
  },
}));
