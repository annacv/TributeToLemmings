import { describe, it, expect } from 'vitest';
import { generateGuestHandle } from './main';

describe('generateGuestHandle', () => {
  it('starts with "Lemming #"', () => {
    expect(generateGuestHandle()).toMatch(/^Lemming #/);
  });

  it('has exactly 3 characters after the prefix', () => {
    const handle = generateGuestHandle();
    const suffix = handle.replace('Lemming #', '');
    expect(suffix).toHaveLength(3);
  });

  it('suffix contains only uppercase letters and digits', () => {
    for (let i = 0; i < 50; i++) {
      const suffix = generateGuestHandle().replace('Lemming #', '');
      expect(suffix).toMatch(/^[A-Z0-9]{3}$/);
    }
  });

  it('produces different handles across calls (probabilistic)', () => {
    const handles = new Set(Array.from({ length: 20 }, generateGuestHandle));
    expect(handles.size).toBeGreaterThan(1);
  });
});
