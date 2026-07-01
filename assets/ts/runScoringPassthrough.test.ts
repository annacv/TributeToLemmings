import { describe, it, expect, beforeAll } from 'vitest';
import { makeBreakdown, LEVEL_POINTS, STALACTITE_POINTS } from './lib/score';
import { TunnelGame, TOTAL_CYCLES } from './worlds/tunnel/TunnelGame';
import { AbyssGame, ABYSS_TIME_BUDGET_S, ABYSS_LEVEL_CONFIG } from './worlds/abyss/AbyssGame';
import { makeCanvas, stubAnimationFrame } from './test-helpers';
import { STEPS_PER_SECOND } from './lib/GameLoop';

const noop = (): void => {};

describe('cumulative score passthrough (seam-test gate)', () => {
  beforeAll(() => {
    stubAnimationFrame();
  });

  it('the win breakdown sums surface + tunnel + abyss + stalactites + levels, dropping nothing', () => {
    const SURFACE_TIME = 42;
    const SURFACE_LEVELS = 3;
    const TUNNEL_BANKED = 23;

    const surfaceBreakdown = makeBreakdown({
      surfaceTime: SURFACE_TIME,
      levelsBonus: SURFACE_LEVELS * LEVEL_POINTS,
    });

    const tunnel = new TunnelGame(makeCanvas(), surfaceBreakdown, noop, noop);
    tunnel.bankedSeconds = TUNNEL_BANKED;
    tunnel.cyclesCleared = TOTAL_CYCLES;
    const tunnelBreakdown = tunnel.currentBreakdown();
    expect(tunnelBreakdown.surfaceTime).toBe(SURFACE_TIME);
    expect(tunnelBreakdown.tunnelTime).toBe(TUNNEL_BANKED);
    expect(tunnelBreakdown.levelsBonus).toBe((SURFACE_LEVELS + TOTAL_CYCLES) * LEVEL_POINTS);

    const abyss = new AbyssGame(makeCanvas(), tunnelBreakdown, noop, noop);
    abyss.startGame();
    if (abyss.player) abyss.player.lives = Number.MAX_SAFE_INTEGER;
    abyss.breaks = { small: 2, medium: 1, large: 1 };
    abyss.stepCount = ABYSS_TIME_BUDGET_S * STEPS_PER_SECOND - 1;
    abyss.step();
    expect(abyss.isOver).toBe(true);

    const breakdown = abyss.currentBreakdown();

    expect(breakdown.surfaceTime).toBe(SURFACE_TIME);
    expect(breakdown.tunnelTime).toBe(TUNNEL_BANKED);
    expect(breakdown.abyssTime).toBe(ABYSS_TIME_BUDGET_S);
    expect(breakdown.stalactites).toEqual({ small: 2, medium: 1, large: 1 });

    const stalactiteBonus = 2 * STALACTITE_POINTS.small + STALACTITE_POINTS.medium + STALACTITE_POINTS.large;
    const levelsBonus = (SURFACE_LEVELS + TOTAL_CYCLES + ABYSS_LEVEL_CONFIG.length) * LEVEL_POINTS;
    expect(breakdown.stalactiteBonus).toBe(stalactiteBonus);
    expect(breakdown.levelsBonus).toBe(levelsBonus);

    expect(breakdown.total).toBe(SURFACE_TIME + TUNNEL_BANKED + ABYSS_TIME_BUDGET_S + stalactiteBonus + levelsBonus);
  });
});
