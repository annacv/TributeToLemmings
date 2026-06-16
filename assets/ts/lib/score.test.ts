import { describe, it, expect } from 'vitest';
import { makeBreakdown, breakdownLines, LEVEL_POINTS } from './score';

describe('ScoreBreakdown', () => {
  it('total always equals the sum of the parts', () => {
    const b = makeBreakdown({ surfaceTime: 62, tunnelTime: 23, levelsBonus: 15 });
    expect(b.total).toBe(b.surfaceTime + b.tunnelTime + b.levelsBonus);
    expect(b.total).toBe(100);
  });

  it('missing parts default to zero', () => {
    const b = makeBreakdown({ surfaceTime: 30 });
    expect(b).toEqual({ surfaceTime: 30, tunnelTime: 0, levelsBonus: 0, total: 30 });
  });

  it('an empty breakdown totals zero', () => {
    expect(makeBreakdown().total).toBe(0);
  });
});

describe('breakdownLines', () => {
  it('shows each component with the rule that produced its points', () => {
    const lines = breakdownLines(makeBreakdown({
      surfaceTime: 42, tunnelTime: 35, levelsBonus: 6 * LEVEL_POINTS,
    }));
    expect(lines).toEqual([
      { label: 'Surface time', rule: '42 s', value: 42 },
      { label: 'Tunnel time', rule: '35 s', value: 35 },
      { label: 'Levels completed', rule: `6 × ${LEVEL_POINTS}`, value: 30 },
    ]);
  });

  it('recovers the raw levels count from the bonus', () => {
    const lines = breakdownLines(makeBreakdown({ levelsBonus: 30 }));
    expect(lines.find((l) => l.label === 'Levels completed')?.rule).toBe(`6 × ${LEVEL_POINTS}`);
  });

  it('has no lives line — lives never score', () => {
    const labels = breakdownLines(makeBreakdown({ surfaceTime: 1, tunnelTime: 1, levelsBonus: 5 }))
      .map((l) => l.label.toLowerCase());
    expect(labels.some((l) => l.includes('live'))).toBe(false);
  });
});
