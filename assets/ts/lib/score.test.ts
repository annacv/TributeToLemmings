import { describe, it, expect } from 'vitest';
import { makeBreakdown, livesBonusPoints, LIFE_BONUS_POINTS } from './score';

describe('ScoreBreakdown', () => {
  it('total always equals the sum of the parts', () => {
    const b = makeBreakdown({ surface: 62, livesBonus: 20, tunnelTime: 23, cyclesBonus: 15 });
    expect(b.total).toBe(b.surface + b.livesBonus + b.tunnelTime + b.cyclesBonus);
    expect(b.total).toBe(120);
  });

  it('missing parts default to zero', () => {
    const b = makeBreakdown({ surface: 30 });
    expect(b).toEqual({ surface: 30, livesBonus: 0, tunnelTime: 0, cyclesBonus: 0, total: 30 });
  });

  it('an empty breakdown totals zero', () => {
    expect(makeBreakdown().total).toBe(0);
  });

  it('livesBonusPoints pays 10 per life and never goes negative', () => {
    expect(livesBonusPoints(3)).toBe(3 * LIFE_BONUS_POINTS);
    expect(livesBonusPoints(0)).toBe(0);
    expect(livesBonusPoints(-1)).toBe(0);
  });
});
