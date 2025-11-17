import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';

// Import and register custom matchers
import './signal-matchers';

describe('Custom Signal Matchers', () => {
  describe('toHaveSignalValue', () => {
    it('should pass when signal has expected value', () => {
      const count = signal(42);

      expect(count).toHaveSignalValue(42);
    });

    it('should pass when computed signal has expected value', () => {
      const count = signal(10);
      const doubled = computed(() => count() * 2);

      expect(doubled).toHaveSignalValue(20);
    });

    it('should fail when signal has different value', () => {
      const count = signal(42);

      expect(() => expect(count).toHaveSignalValue(100)).toThrow();
    });

    it('should work with string values', () => {
      const name = signal('Alice');

      expect(name).toHaveSignalValue('Alice');
    });

    it('should work with boolean values', () => {
      const isActive = signal(true);

      expect(isActive).toHaveSignalValue(true);
    });

    it('should work with object values', () => {
      const user = signal({ id: 1, name: 'Alice' });

      expect(user).toHaveSignalValue({ id: 1, name: 'Alice' });
    });

    it('should work with array values', () => {
      const items = signal([1, 2, 3]);

      expect(items).toHaveSignalValue([1, 2, 3]);
    });

    it('should work with null values', () => {
      const value = signal(null);

      expect(value).toHaveSignalValue(null);
    });

    it('should work with undefined values', () => {
      const value = signal<string | undefined>(undefined);

      expect(value).toHaveSignalValue(undefined);
    });

    it('should update when signal value changes', () => {
      const count = signal(0);

      expect(count).toHaveSignalValue(0);

      count.set(10);

      expect(count).toHaveSignalValue(10);
    });
  });
});
