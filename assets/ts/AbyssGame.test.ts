import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  AbyssGame, ABYSS_LEVELS, ABYSS_LEVEL_THRESHOLDS_S, ABYSS_TIME_BUDGET_S,
} from './AbyssGame';
import { Stalactite, STALACTITE_COST } from './Stalactite';
import { makeBreakdown, STALACTITE_POINTS } from './lib/score';
import { makeCanvas } from './test-helpers';

const STEPS_PER_SECOND = 60;
const W = 400;

function makeAbyss(
  canvas: HTMLCanvasElement,
  base = makeBreakdown({ surfaceTime: 42, tunnelTime: 30, levelsBonus: 30 }),
) {
  const game = new AbyssGame(canvas, base);
  game.startGame();
  return game;
}

function stepFor(game: AbyssGame, steps: number): void {
  for (let i = 0; i < steps && !game.isOver; i++) game.step();
}

/** Survive falling bombs so a long run can reach a time/level milestone. */
function invincible(game: AbyssGame): AbyssGame {
  if (game.player) game.player.lives = Number.MAX_SAFE_INTEGER;
  return game;
}

/** Drops a stalactite of `size` directly over the lemming and arms `carried` bombs. */
function setOverhead(game: AbyssGame, size: 'small' | 'medium' | 'large', carried: number): Stalactite {
  const st = new Stalactite(size, game.playerWorldX);
  game.stalactites = [st];
  game.carried = carried;
  return st;
}

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

describe('AbyssGame — per-level tunables (escalation)', () => {
  it('shortens the bomb interval and speeds bombs up each level', () => {
    expect(ABYSS_LEVELS[1].spawnIntervalFrames).toBeLessThan(ABYSS_LEVELS[0].spawnIntervalFrames);
    expect(ABYSS_LEVELS[2].spawnIntervalFrames).toBeLessThan(ABYSS_LEVELS[1].spawnIntervalFrames);
    expect(ABYSS_LEVELS[1].bombSpeed).toBeGreaterThan(ABYSS_LEVELS[0].bombSpeed);
    expect(ABYSS_LEVELS[2].bombSpeed).toBeGreaterThan(ABYSS_LEVELS[1].bombSpeed);
  });

  it('adds one larger size per level, each needing one more hit', () => {
    expect(ABYSS_LEVELS[0].sizes).toEqual(['small']);
    expect(ABYSS_LEVELS[1].sizes).toEqual(['small', 'medium']);
    expect(ABYSS_LEVELS[2].sizes).toEqual(['small', 'medium', 'large']);
    expect(STALACTITE_COST.small).toBe(1);
    expect(STALACTITE_COST.medium).toBe(2);
    expect(STALACTITE_COST.large).toBe(3);
  });

  it('the run budget is the sum of the three level windows', () => {
    expect(ABYSS_LEVEL_THRESHOLDS_S).toEqual([0, 18, 36]);
    expect(ABYSS_TIME_BUDGET_S).toBe(72);
  });
});

describe('AbyssGame — side-scroll camera (offset math)', () => {
  it('advances the camera so world points scroll left', () => {
    const game = makeAbyss(makeCanvas(W, W));
    const cameraBefore = game.cameraX; // GameLoop.start() already ran one step
    const screenBefore = game.worldToScreenX(200);
    game.step();
    expect(game.cameraX).toBeGreaterThan(cameraBefore);
    expect(game.worldToScreenX(200)).toBeLessThan(screenBefore);
  });

  it('pins an idle lemming to the left of the dodge window and carries it rightward', () => {
    const game = makeAbyss(makeCanvas(W, W));
    if (game.player) game.player.direction = 0;
    const startWorldX = game.playerWorldX;
    stepFor(game, 10);
    expect(game.playerScreenX()).toBeCloseTo(W * 0.18, 5); // pinned at the left margin
    expect(game.playerWorldX).toBeGreaterThan(startWorldX); // carried forward by the camera
  });

  it('steers the lemming rightward within the window on input', () => {
    const game = makeAbyss(makeCanvas(W, W));
    if (game.player) game.player.direction = 1;
    game.step();
    expect(game.playerScreenX()).toBeGreaterThan(W * 0.18);
    expect(game.playerScreenX()).toBeLessThanOrEqual(W * 0.62 + 1e-9);
  });
});

describe('AbyssGame — gather (pickup + cap)', () => {
  it('picks up a floor bomb underfoot and plays the pickup cue', () => {
    const game = makeAbyss(makeCanvas(W, W));
    const play = vi.spyOn(game.sfx, 'play');
    game.floorBombs = [game.playerWorldX];
    game.carried = 0;
    game.action();
    expect(game.carried).toBe(1);
    expect(game.floorBombs).toHaveLength(0);
    expect(play).toHaveBeenCalledWith('pickup');
  });

  it('will not pick up past the carry cap', () => {
    const game = makeAbyss(makeCanvas(W, W));
    game.carried = 3; // cap
    game.floorBombs = [game.playerWorldX];
    game.action();
    expect(game.carried).toBe(3);
    expect(game.floorBombs).toHaveLength(1);
  });
});

describe('AbyssGame — throw (smash stalactites)', () => {
  it('does nothing empty-handed', () => {
    const game = makeAbyss(makeCanvas(W, W));
    const st = setOverhead(game, 'small', 0);
    game.action();
    expect(st.hitsRemaining).toBe(1);
    expect(game.carried).toBe(0);
  });

  it('smashes a small stalactite in one hit and scores it', () => {
    const game = makeAbyss(makeCanvas(W, W));
    const play = vi.spyOn(game.sfx, 'play');
    const st = setOverhead(game, 'small', 1);
    game.action();
    expect(st.destroyed).toBe(true);
    expect(game.carried).toBe(0);
    expect(game.breaks.small).toBe(1);
    expect(play).toHaveBeenCalledWith('mantrap');
    expect(play).toHaveBeenCalledWith('thud');
  });

  it('needs the size-scaled hit count: a medium takes two throws', () => {
    const game = makeAbyss(makeCanvas(W, W));
    const st = setOverhead(game, 'medium', 2);
    game.action();
    expect(st.destroyed).toBe(false);
    expect(st.hitsTaken).toBe(1);
    expect(game.breaks.medium).toBe(0);
    game.action();
    expect(st.destroyed).toBe(true);
    expect(game.breaks.medium).toBe(1);
    expect(game.carried).toBe(0);
  });

  it('feeds the per-size stalactite bonus into the breakdown', () => {
    const game = makeAbyss(makeCanvas(W, W));
    game.breaks = { small: 2, medium: 1, large: 1 };
    const bonus = game.currentBreakdown().stalactiteBonus;
    expect(bonus).toBe(2 * STALACTITE_POINTS.small + STALACTITE_POINTS.medium + STALACTITE_POINTS.large);
  });
});

describe('AbyssGame — time-gated level progression', () => {
  it('advances to L2 at 18 s and L3 at 36 s, by time alone', () => {
    const game = invincible(makeAbyss(makeCanvas(W, W)));
    expect(game.currentLevel).toBe(0);
    stepFor(game, 18 * STEPS_PER_SECOND);
    expect(game.currentLevel).toBe(1);
    stepFor(game, 18 * STEPS_PER_SECOND);
    expect(game.currentLevel).toBe(2);
  });

  it('breaking stalactites does not gate progression', () => {
    const game = invincible(makeAbyss(makeCanvas(W, W)));
    const st = setOverhead(game, 'small', 3);
    game.action(); // a break well before 18 s
    expect(st.destroyed).toBe(true);
    stepFor(game, 5 * STEPS_PER_SECOND);
    expect(game.currentLevel).toBe(0); // still L1 — time, not breaks, advances
  });

  it('ends the run at the L3 time budget and routes as a completion', () => {
    const game = invincible(makeAbyss(makeCanvas(W, W)));
    stepFor(game, ABYSS_TIME_BUDGET_S * STEPS_PER_SECOND);
    expect(game.isOver).toBe(true);
    const b = game.currentBreakdown();
    expect(b.abyssTime).toBe(ABYSS_TIME_BUDGET_S);
    // full completion counts all three abyss levels on top of the base
    expect(b.levelsBonus).toBe(30 + 3 * 5);
  });
});

describe('AbyssGame — scoring (levels exclude the one died on)', () => {
  it('on death, counts only abyss levels fully passed', () => {
    const game = invincible(makeAbyss(makeCanvas(W, W)));
    stepFor(game, 18 * STEPS_PER_SECOND); // now in L2 (index 1)
    expect(game.currentLevel).toBe(1);
    // death keeps the default 'death' outcome → L2 (the level died on) excluded
    const b = game.currentBreakdown();
    expect(b.levelsBonus).toBe(30 + 1 * 5);
  });
});
