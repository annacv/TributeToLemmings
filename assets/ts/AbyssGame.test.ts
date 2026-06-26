import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import {
  AbyssGame, ABYSS_LEVEL_CONFIG, ABYSS_TIME_BUDGET_S, THROW_FLIGHT_STEPS,
} from './AbyssGame';
import { Stalactite, STALACTITE_COST } from './Stalactite';
import { Bomb } from './Bomb';
import { makeBreakdown, STALACTITE_POINTS } from './lib/score';
import { makeCanvas } from './test-helpers';
import { STEPS_PER_SECOND } from './lib/GameLoop';

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
    expect(ABYSS_LEVEL_CONFIG[1].spawnIntervalFrames).toBeLessThan(ABYSS_LEVEL_CONFIG[0].spawnIntervalFrames);
    expect(ABYSS_LEVEL_CONFIG[2].spawnIntervalFrames).toBeLessThan(ABYSS_LEVEL_CONFIG[1].spawnIntervalFrames);
    expect(ABYSS_LEVEL_CONFIG[1].bombSpeed).toBeGreaterThan(ABYSS_LEVEL_CONFIG[0].bombSpeed);
    expect(ABYSS_LEVEL_CONFIG[2].bombSpeed).toBeGreaterThan(ABYSS_LEVEL_CONFIG[1].bombSpeed);
  });

  it('adds one larger size per level, each needing one more hit', () => {
    expect(ABYSS_LEVEL_CONFIG[0].sizes).toEqual(['small']);
    expect(ABYSS_LEVEL_CONFIG[1].sizes).toEqual(['small', 'medium']);
    expect(ABYSS_LEVEL_CONFIG[2].sizes).toEqual(['small', 'medium', 'large']);
    expect(STALACTITE_COST.small).toBe(1);
    expect(STALACTITE_COST.medium).toBe(2);
    expect(STALACTITE_COST.large).toBe(3);
  });

});

describe('AbyssGame — Player-driven camera', () => {
  it('spawns the lemming below the ceiling door and does not auto-scroll while idle', () => {
    const game = makeAbyss(makeCanvas(W, W));
    if (game.player) game.player.direction = 0;
    const cam = game.cameraX;
    const worldX = game.playerWorldX;
    expect(game.playerScreenX()).toBeCloseTo(game.entranceWorldX, 5); // under the door on the ground
    stepFor(game, 30);
    expect(game.cameraX).toBe(cam);                          // no constant scroll
    expect(game.playerWorldX).toBe(worldX);                  // stays put — can stand on a bomb
  });

  it('moves at the shared player speed (same as the other worlds)', () => {
    const game = makeAbyss(makeCanvas(W, W));
    const before = game.playerWorldX;
    if (game.player) game.player.direction = 1;
    game.step();
    expect(game.playerWorldX - before).toBeCloseTo(game.player!.speed, 5);
  });

  it('moves the lemming rightward and the camera follows it past the follow line', () => {
    const game = makeAbyss(makeCanvas(W, W));
    if (game.player) game.player.direction = 1;
    stepFor(game, 200);
    expect(game.cameraX).toBeGreaterThan(0);                 // camera pulled forward by the lemming
    expect(game.playerScreenX()).toBeCloseTo(W * 0.5, 5);    // pinned at the follow line on screen
  });

  it('never walks onto the left framing column and never scrolls back (one-way)', () => {
    const game = makeAbyss(makeCanvas(W, W));
    if (game.player) game.player.direction = 1;
    stepFor(game, 200);
    const advanced = game.cameraX;
    expect(advanced).toBeGreaterThan(0);
    if (game.player) game.player.direction = -1;
    stepFor(game, 600);
    expect(game.cameraX).toBe(advanced);                                  // no scroll-back
    expect(game.playerWorldX).toBeGreaterThanOrEqual(W * 0.34 - 1e-9);    // off the start column
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
    game.carried = game.carryCap;
    game.floorBombs = [game.playerWorldX];
    game.action();
    expect(game.carried).toBe(game.carryCap);
    expect(game.floorBombs).toHaveLength(1);
  });
});

describe('AbyssGame — bomb spawning', () => {
  it('keeps bombs inside the walkable corridor (off the left framing column)', () => {
    const game = invincible(makeAbyss(makeCanvas(W, W)));
    if (game.player) game.player.direction = 0; // idle: camera stays at the corridor start
    stepFor(game, 300);
    const minX = W * 0.34 - 1e-9; // CORRIDOR_START_FRAC
    for (const b of game.fallingBombs) expect(b.dx).toBeGreaterThanOrEqual(minX);
    for (const x of game.floorBombs) expect(x).toBeGreaterThanOrEqual(minX);
    expect(game.fallingBombs.length + game.floorBombs.length).toBeGreaterThan(0);
  });

  it('plays the bomb-hit cue and drops a life when a bomb strikes the lemming', () => {
    const game = makeAbyss(makeCanvas(W, W));
    const play = vi.spyOn(game.sfx, 'play');
    const before = game.player!.lives;
    const bomb = new Bomb(game.canvas, game.playerWorldX, 1.2);
    bomb.dy = game.player!.dy - 5; // overlapping the lemming, above the floor line
    game.fallingBombs = [bomb];
    game.step();
    expect(game.player!.lives).toBe(before - 1);
    expect(play).toHaveBeenCalledWith('bombHit');
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
    expect(game.carried).toBe(0);
    expect(play).toHaveBeenCalledWith('pickup'); // throw cue at release
    expect(game.thrownBombs).toHaveLength(1);    // a bomb is in flight…
    expect(st.destroyed).toBe(false);            // …and hasn't struck yet
    stepFor(game, THROW_FLIGHT_STEPS);           // let it land
    expect(st.destroyed).toBe(true);
    expect(game.breaks.small).toBe(1);
    expect(play).toHaveBeenCalledWith('mantrap');
    expect(play).toHaveBeenCalledWith('thud');
  });

  it('needs the size-scaled hit count: a medium takes two throws', () => {
    const game = makeAbyss(makeCanvas(W, W));
    const st = setOverhead(game, 'medium', 2);
    game.action();
    stepFor(game, THROW_FLIGHT_STEPS);
    expect(st.destroyed).toBe(false);
    expect(st.hitsTaken).toBe(1);
    expect(game.breaks.medium).toBe(0);
    game.action();
    stepFor(game, THROW_FLIGHT_STEPS);
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

  it('plays the level-up cue on a time-gated level change', () => {
    const game = invincible(makeAbyss(makeCanvas(W, W)));
    const play = vi.spyOn(game.sfx, 'play');
    stepFor(game, 18 * STEPS_PER_SECOND);
    expect(game.currentLevel).toBe(1);
    expect(play).toHaveBeenCalledWith('levelUp');
  });

  it('breaking stalactites does not gate progression', () => {
    const game = invincible(makeAbyss(makeCanvas(W, W)));
    const st = setOverhead(game, 'small', 3);
    game.action(); // a break well before 18 s
    stepFor(game, 5 * STEPS_PER_SECOND);
    expect(st.destroyed).toBe(true); // the thrown bomb landed
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

describe('AbyssGame — cold-open and exit-door beats', () => {
  const reducedMotion = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    /* the shared rAF stubs are re-applied so the rest of the suite keeps them */
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('cold-open holds the closed hatch, plays DOOR.WAV, then hands off to play', () => {
    vi.useFakeTimers();
    const game = new AbyssGame(makeCanvas(W, W), makeBreakdown({}));
    const play = vi.spyOn(game.sfx, 'play');
    const onDone = vi.fn();
    game.coldOpen(onDone);
    expect(game.entranceOpenFrac).toBe(0); // closed on arrival
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(650);
    expect(play).toHaveBeenCalledWith('door'); // the cue precedes the drop
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1300);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith('falling', { playbackRate: 2, volume: 0.5 });
    expect(play).toHaveBeenCalledWith('thud'); // lands on the corridor floor
  });

  it('reduced motion resolves the cold-open straight to the grounded, door-open state', () => {
    vi.stubGlobal('matchMedia', reducedMotion);
    const game = new AbyssGame(makeCanvas(W, W), makeBreakdown({}));
    const play = vi.spyOn(game.sfx, 'play');
    const onDone = vi.fn();
    game.coldOpen(onDone);
    expect(game.entranceOpenFrac).toBe(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith('thud'); // lands at once
  });

  it('reduced-motion exit close plays LETSGO and routes the completion at once', () => {
    vi.stubGlobal('matchMedia', reducedMotion);
    const game = new AbyssGame(makeCanvas(W, W), makeBreakdown({ levelsBonus: 30 }));
    game.startGame();
    invincible(game);
    const onComplete = vi.fn();
    game.completionCallback(onComplete);
    const play = vi.spyOn(game.sfx, 'play');
    game.stepCount = ABYSS_TIME_BUDGET_S * STEPS_PER_SECOND - 1;
    game.step(); // crosses the L3 budget → reachDoor (completion)
    game['endRun']();
    expect(play).toHaveBeenCalledWith('letsgo');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(game.player).toBeNull(); // vanished into the door
  });
});
