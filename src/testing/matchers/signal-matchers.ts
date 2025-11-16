import { expect } from 'vitest';
import type { Signal } from '@angular/core';

/**
 * Custom Vitest matchers for Angular signals
 */
expect.extend({
  /**
   * Check if signal has specific value
   */
  toHaveSignalValue(received: Signal<unknown>, expected: unknown) {
    const actualValue = received();

    // Use deep equality check for objects and arrays
    const pass =
      typeof expected === 'object' && expected !== null
        ? JSON.stringify(actualValue) === JSON.stringify(expected)
        : Object.is(actualValue, expected);

    return {
      pass,
      message: () =>
        pass
          ? `Expected signal not to have value ${JSON.stringify(expected)}, but it does`
          : `Expected signal to have value ${JSON.stringify(expected)}, but it has ${JSON.stringify(actualValue)}`,
    };
  },
});
