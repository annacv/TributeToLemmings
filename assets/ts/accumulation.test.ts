import { describe, it, expect, vi, beforeAll } from 'vitest';
import { TunnelGame, TOTAL_CYCLES } from './TunnelGame';
import { AbyssGame, ABYSS_TIME_BUDGET_S, ABYSS_LEVEL_CONFIG } from './AbyssGame';
import { makeBreakdown, LEVEL_POINTS, STALACTITE_POINTS } from './lib/score';
import { makeCanvas } from './test-helpers';
import { STEPS_PER_SECOND } from './lib/GameLoop';

/* End-to-end cumulative scoring: a single breakdown threaded surface → tunnel →
   abyss → win, through the real game classes' currentBreakdown chaining. Each leg
   is unit-tested in isolation elsewhere; this guards the *whole chain* so a hop
   that silently drops a prior component (the exact regression a future screen/
   ScreenManager refactor could introduce) fails loudly here. */

const W = 400;

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

describe('cumulative scoring threads through all three worlds', () => {
  it('the win breakdown sums surface + tunnel + abyss + stalactites + levels, dropping nothing', () => {
    const SURFACE_TIME = 42;
    const SURFACE_LEVELS = 3;
    const TUNNEL_BANKED = 23;

    /* Surface hands off exactly this shape (SurfaceGame.currentBreakdown). */
    const surfaceBreakdown = makeBreakdown({
      surfaceTime: SURFACE_TIME,
      levelsBonus: SURFACE_LEVELS * LEVEL_POINTS,
    });

    /* Tunnel carries the surface forward and adds banked seconds + cleared cycles. */
    const tunnel = new TunnelGame(makeCanvas(W, W), surfaceBreakdown);
    tunnel.bankedSeconds = TUNNEL_BANKED;
    tunnel.cyclesCleared = TOTAL_CYCLES;
    const tunnelBreakdown = tunnel.currentBreakdown();
    expect(tunnelBreakdown.surfaceTime).toBe(SURFACE_TIME); // surface survived the hop
    expect(tunnelBreakdown.tunnelTime).toBe(TUNNEL_BANKED);
    expect(tunnelBreakdown.levelsBonus).toBe((SURFACE_LEVELS + TOTAL_CYCLES) * LEVEL_POINTS);

    /* Abyss carries surface + tunnel forward and adds abyss time + stalactites +
       abyss levels; drive it to the real completion (crossing the L3 time budget). */
    const abyss = new AbyssGame(makeCanvas(W, W), tunnelBreakdown);
    abyss.startGame();
    if (abyss.player) abyss.player.lives = Number.MAX_SAFE_INTEGER;
    abyss.breaks = { small: 2, medium: 1, large: 1 };
    abyss.stepCount = ABYSS_TIME_BUDGET_S * STEPS_PER_SECOND - 1;
    abyss.step(); // crosses the budget → reachDoor → completion
    expect(abyss.isOver).toBe(true);

    const win = abyss.currentBreakdown();

    /* Every prior component survived both hops. */
    expect(win.surfaceTime).toBe(SURFACE_TIME);
    expect(win.tunnelTime).toBe(TUNNEL_BANKED);
    expect(win.abyssTime).toBe(ABYSS_TIME_BUDGET_S);
    expect(win.stalactites).toEqual({ small: 2, medium: 1, large: 1 });

    const stalactiteBonus = 2 * STALACTITE_POINTS.small + STALACTITE_POINTS.medium + STALACTITE_POINTS.large;
    const levelsBonus = (SURFACE_LEVELS + TOTAL_CYCLES + ABYSS_LEVEL_CONFIG.length) * LEVEL_POINTS;
    expect(win.stalactiteBonus).toBe(stalactiteBonus);
    expect(win.levelsBonus).toBe(levelsBonus);

    /* The total equals the sum of all three worlds — nothing dropped at any handoff. */
    expect(win.total).toBe(SURFACE_TIME + TUNNEL_BANKED + ABYSS_TIME_BUDGET_S + stalactiteBonus + levelsBonus);
  });
});
