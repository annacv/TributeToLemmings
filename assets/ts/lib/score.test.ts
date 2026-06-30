import { describe, it, expect } from 'vitest';
import {
  makeBreakdown, breakdownLines, LEVEL_POINTS, STALACTITE_POINTS,
} from './score';

describe('ScoreBreakdown', () => {
  it('total always equals the sum of the parts (three worlds)', () => {
    const breakdown = makeBreakdown({
      surfaceTime: 62,
      tunnelTime: 23,
      abyssTime: 30,
      stalactites: { small: 2, medium: 1, large: 0 },
      levelsBonus: 45,
    });
    expect(breakdown.total).toBe(
      breakdown.surfaceTime + breakdown.tunnelTime + breakdown.abyssTime + breakdown.stalactiteBonus + breakdown.levelsBonus,
    );
    expect(breakdown.total).toBe(62 + 23 + 30 + 20 + 45);
  });

  it('derives the stalactite bonus from the per-size weights', () => {
    const breakdown = makeBreakdown({ stalactites: { small: 3, medium: 2, large: 1 } });
    expect(breakdown.stalactiteBonus).toBe(
      3 * STALACTITE_POINTS.small + 2 * STALACTITE_POINTS.medium + 1 * STALACTITE_POINTS.large,
    );
    expect(breakdown.stalactiteBonus).toBe(breakdown.total);
  });

  it('missing parts default to zero', () => {
    const breakdown = makeBreakdown({ surfaceTime: 30 });
    expect(breakdown).toEqual({
      surfaceTime: 30,
      tunnelTime: 0,
      abyssTime: 0,
      stalactites: { small: 0, medium: 0, large: 0 },
      stalactiteBonus: 0,
      levelsBonus: 0,
      total: 30,
    });
  });

  it('an empty breakdown totals zero', () => {
    expect(makeBreakdown().total).toBe(0);
  });

  it('never aliases the caller’s live stalactite counters', () => {
    const live = { small: 1, medium: 0, large: 0 };
    const breakdown = makeBreakdown({ stalactites: live });
    live.small = 99;
    expect(breakdown.stalactites.small).toBe(1);
  });
});

describe('Surface and Tunnel numbers are unchanged', () => {
  it('surface-only run scores surface time + levels, no abyss/stalactite components', () => {
    const breakdown = makeBreakdown({ surfaceTime: 42, levelsBonus: 2 * LEVEL_POINTS });
    expect(breakdown.total).toBe(42 + 10);
    expect(breakdown.abyssTime).toBe(0);
    expect(breakdown.stalactiteBonus).toBe(0);
  });

  it('surface + tunnel run is unaffected by the new fields', () => {
    const breakdown = makeBreakdown({ surfaceTime: 42, tunnelTime: 35, levelsBonus: 6 * LEVEL_POINTS });
    expect(breakdown.total).toBe(42 + 35 + 30);
  });
});

describe('levels score across all three worlds', () => {
  it('full completion counts every level across surface + tunnel + abyss', () => {
    const surfaceLevels = 3;
    const tunnelCycles = 3;
    const abyssLevels = 3;
    const breakdown = makeBreakdown({
      surfaceTime: 42,
      tunnelTime: 30,
      abyssTime: 54,
      stalactites: { small: 4, medium: 2, large: 1 },
      levelsBonus: (surfaceLevels + tunnelCycles + abyssLevels) * LEVEL_POINTS,
    });
    expect(breakdown.levelsBonus).toBe(9 * LEVEL_POINTS);
    expect(breakdown.total).toBe(42 + 30 + 54 + (4 * 5 + 2 * 10 + 1 * 15) + 45);
  });
});

describe('breakdownLines', () => {
  it('shows each component with the rule that produced its points', () => {
    const lines = breakdownLines(makeBreakdown({
      surfaceTime: 42,
      tunnelTime: 35,
      abyssTime: 30,
      stalactites: { small: 2, medium: 1, large: 0 },
      levelsBonus: 9 * LEVEL_POINTS,
    }));
    expect(lines).toEqual([
      { label: 'Surface time', rule: '42 s', value: 42 },
      { label: 'Tunnel time', rule: '35 s', value: 35 },
      { label: 'Abyss time', rule: '30 s', value: 30 },
      { label: 'Stalactites', rule: '2×5 + 1×10', value: 20 },
      { label: 'Levels completed', rule: `9 × ${LEVEL_POINTS}`, value: 45 },
    ]);
  });

  it('zero-value lines are filtered out by the caller, so they read 0', () => {
    const lines = breakdownLines(makeBreakdown({ surfaceTime: 42, levelsBonus: 5 }));
    const abyssLine = lines.find((l) => l.label === 'Abyss time');
    const stalactitesLine = lines.find((l) => l.label === 'Stalactites');
    expect(abyssLine).toEqual({ label: 'Abyss time', rule: '0 s', value: 0 });
    expect(stalactitesLine).toEqual({ label: 'Stalactites', rule: '0', value: 0 });
  });

  it('has no lives line — lives never score', () => {
    const labels = breakdownLines(makeBreakdown({ surfaceTime: 1, tunnelTime: 1, levelsBonus: 5 }))
      .map((l) => l.label.toLowerCase());
    expect(labels.some((l) => l.includes('live'))).toBe(false);
  });
});
