/**
 * Custom Vitest matchers for testing
 *
 * @module testing/matchers
 */

import './media-matchers';
import './signal-matchers';

/**
 * Register all custom matchers
 * This is automatically imported in test-setup.ts
 */
export function registerCustomMatchers(): void {
  // Matchers are registered via expect.extend() in their respective files
  // This function is kept for compatibility and explicit registration if needed
}

// Re-export types
export type {} from './types';
