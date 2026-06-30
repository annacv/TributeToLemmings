import { describe, it, expect } from 'vitest';
import { generateGuestHandle } from './startScreen';

describe('generateGuestHandle', () => {
  it('formats as "Lemming #" + 5 uppercase letters/digits', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateGuestHandle()).toMatch(/^Lemming #[A-Z0-9]{5}$/);
    }
  });

  it('produces different handles across calls (probabilistic)', () => {
    const handles = new Set(Array.from({ length: 20 }, generateGuestHandle));
    expect(handles.size).toBeGreaterThan(1);
  });
});
