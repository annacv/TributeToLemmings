import { describe, it, expect } from 'vitest';
import {
  makeBreakdown, breakdownLines, LEVEL_POINTS, STALACTITE_POINTS,
} from './score';

describe('ScoreBreakdown', () => {
  it('total always equals the sum of the parts (three worlds)', () => {
    const b = makeBreakdown({
      surfaceTime: 62,
      tunnelTime: 23,
      abyssTime: 30,
      stalactites: { small: 2, medium: 1, large: 0 },
      levelsBonus: 45,
    });
    expect(b.total).toBe(
      b.surfaceTime + b.tunnelTime + b.abyssTime + b.stalactiteBonus + b.levelsBonus,
    );
    expect(b.total).toBe(62 + 23 + 30 + 20 + 45);
  });

  it('derives the stalactite bonus from the per-size weights', () => {
    const b = makeBreakdown({ stalactites: { small: 3, medium: 2, large: 1 } });
    expect(b.stalactiteBonus).toBe(
      3 * STALACTITE_POINTS.small + 2 * STALACTITE_POINTS.medium + 1 * STALACTITE_POINTS.large,
    );
    expect(b.stalactiteBonus).toBe(b.total);
  });

  it('missing parts default to zero', () => {
    const b = makeBreakdown({ surfaceTime: 30 });
    expect(b).toEqual({
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
    const b = makeBreakdown({ stalactites: live });
    live.small = 99;
    expect(b.stalactites.small).toBe(1);
  });
});

describe('Surface and Tunnel numbers are unchanged', () => {
  it('surface-only run scores surface time + levels, no abyss/stalactite components', () => {
    const b = makeBreakdown({ surfaceTime: 42, levelsBonus: 2 * LEVEL_POINTS });
    expect(b.total).toBe(42 + 10);
    expect(b.abyssTime).toBe(0);
    expect(b.stalactiteBonus).toBe(0);
  });

  it('surface + tunnel run is unaffected by the new fields', () => {
    const b = makeBreakdown({ surfaceTime: 42, tunnelTime: 35, levelsBonus: 6 * LEVEL_POINTS });
    expect(b.total).toBe(42 + 35 + 30);
  });
});

describe('levels score across all three worlds', () => {
  it('abyss death excludes the level died on', () => {
    // Entered the abyss with S + C = 6 prior levels; dies on abyss level 3.
    // Counts abyss L1 + L2 only → 6 + (3 − 1) = 8 levels.
    const priorLevels = 6;
    const diedOnAbyssLevel = 3;
    const levels = priorLevels + (diedOnAbyssLevel - 1);
    const b = makeBreakdown({
      surfaceTime: 42, tunnelTime: 30, abyssTime: 24, levelsBonus: levels * LEVEL_POINTS,
    });
    expect(b.levelsBonus).toBe(8 * LEVEL_POINTS);
    expect(b.total).toBe(42 + 30 + 24 + 0 + 40);
  });

  it('full completion counts every level across surface + tunnel + abyss', () => {
    const surfaceLevels = 3;
    const tunnelCycles = 3;
    const abyssLevels = 3;
    const b = makeBreakdown({
      surfaceTime: 42,
      tunnelTime: 30,
      abyssTime: 54,
      stalactites: { small: 4, medium: 2, large: 1 },
      levelsBonus: (surfaceLevels + tunnelCycles + abyssLevels) * LEVEL_POINTS,
    });
    expect(b.levelsBonus).toBe(9 * LEVEL_POINTS);
    expect(b.total).toBe(42 + 30 + 54 + (4 * 5 + 2 * 10 + 1 * 15) + 45);
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
    const abyss = lines.find((l) => l.label === 'Abyss time');
    const stal = lines.find((l) => l.label === 'Stalactites');
    expect(abyss).toEqual({ label: 'Abyss time', rule: '0 s', value: 0 });
    expect(stal).toEqual({ label: 'Stalactites', rule: '0', value: 0 });
  });

  it('has no lives line — lives never score', () => {
    const labels = breakdownLines(makeBreakdown({ surfaceTime: 1, tunnelTime: 1, levelsBonus: 5 }))
      .map((l) => l.label.toLowerCase());
    expect(labels.some((l) => l.includes('live'))).toBe(false);
  });
});
