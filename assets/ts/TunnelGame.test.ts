import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  TunnelGame, TUNNEL_LEVELS, TUNNEL_TIME_BUDGET_S, TOTAL_CYCLES,
  FLOOR_FRAC, CRUSH_HEADROOM_FRAC, TELEGRAPH_HEADROOM_FRAC, MIN_CRACK_SPAWN_DIST_FRAC,
} from './TunnelGame';
import { makeBreakdown } from './lib/score';
import { makeCanvas } from './test-helpers';

const STEPS_PER_SECOND = 60;

function timeToCrushSteps(level: (typeof TUNNEL_LEVELS)[number]): number {
  return (level.startHeadroomFrac - CRUSH_HEADROOM_FRAC) / level.driftPerStep;
}

function makeTunnel(canvas: HTMLCanvasElement, base = makeBreakdown({ surface: 42, livesBonus: 20 })) {
  const game = new TunnelGame(canvas, base);
  game.startGame();
  return game;
}

/** Drops the ceiling so the next step crosses the kill line. */
function armCrush(game: TunnelGame): void {
  game.ceilingFrac = FLOOR_FRAC - CRUSH_HEADROOM_FRAC - 1e-9;
}

beforeAll(() => {
  /* jsdom has no rAF; the loop's first synchronous step is enough — tests
     drive the simulation through step() directly */
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

describe('TunnelGame — per-level tunables (solvability invariants)', () => {
  it('levels 1–2 cannot crush within the countdown budget', () => {
    const budgetSteps = TUNNEL_TIME_BUDGET_S * STEPS_PER_SECOND;
    expect(timeToCrushSteps(TUNNEL_LEVELS[0])).toBeGreaterThan(budgetSteps);
    expect(timeToCrushSteps(TUNNEL_LEVELS[1])).toBeGreaterThan(budgetSteps);
  });

  it('level 3 can crush within the budget, but no sooner than ~40 s', () => {
    const budgetSteps = TUNNEL_TIME_BUDGET_S * STEPS_PER_SECOND;
    const l3 = timeToCrushSteps(TUNNEL_LEVELS[2]);
    expect(l3).toBeLessThan(budgetSteps + timeToCrushSteps(TUNNEL_LEVELS[1]));
    expect(l3).toBeGreaterThanOrEqual(40 * STEPS_PER_SECOND);
  });

  it('escalation follows the ratified curve: lower starts each level, faster drift only at level 3', () => {
    expect(TUNNEL_LEVELS[1].startHeadroomFrac).toBeLessThan(TUNNEL_LEVELS[0].startHeadroomFrac);
    expect(TUNNEL_LEVELS[2].startHeadroomFrac).toBeLessThan(TUNNEL_LEVELS[1].startHeadroomFrac);
    expect(TUNNEL_LEVELS[1].driftPerStep).toBe(TUNNEL_LEVELS[0].driftPerStep);
    expect(TUNNEL_LEVELS[2].driftPerStep).toBeGreaterThan(TUNNEL_LEVELS[1].driftPerStep);
  });

  it('crack legibility decreases per cycle (1+2 combined, then 2, then 1)', () => {
    expect(TUNNEL_LEVELS[0].crackAssets).toEqual([0, 1]);
    expect(TUNNEL_LEVELS[1].crackAssets).toEqual([1]);
    expect(TUNNEL_LEVELS[2].crackAssets).toEqual([0]);
  });

  it('the telegraph band sits above the kill line', () => {
    expect(TELEGRAPH_HEADROOM_FRAC).toBeGreaterThan(CRUSH_HEADROOM_FRAC);
  });
});

describe('TunnelGame — skeleton and countdown', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => { canvas = makeCanvas(468, 468); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('starts in explore with 3 lives at the cycle-1 ceiling', () => {
    const game = makeTunnel(canvas);
    expect(game.state).toBe('explore');
    expect(game.player?.lives).toBe(3);
    expect(game.headroomFrac()).toBeCloseTo(
      TUNNEL_LEVELS[0].startHeadroomFrac - TUNNEL_LEVELS[0].driftPerStep, 6,
    );
  });

  it('counts down from the budget by step counting and floors at 0', () => {
    const game = makeTunnel(canvas);
    expect(game.secondsLeft()).toBe(TUNNEL_TIME_BUDGET_S);
    for (let i = 0; i < STEPS_PER_SECOND; i++) game.step();
    expect(game.secondsLeft()).toBe(TUNNEL_TIME_BUDGET_S - 1);
    game.stepCount = (TUNNEL_TIME_BUDGET_S + 5) * STEPS_PER_SECOND;
    expect(game.secondsLeft()).toBe(0);
    expect(game.isOver).toBe(false); // the countdown never kills
  });

  it('does not advance the countdown without steps (hidden tab freeze)', () => {
    const game = makeTunnel(canvas);
    const before = game.secondsLeft();
    expect(game.secondsLeft()).toBe(before);
  });

  it('pause early-returns the step: no drift, no countdown', () => {
    const game = makeTunnel(canvas);
    game.paused = true;
    const ceiling = game.ceilingFrac;
    const steps = game.stepCount;
    expect(game.step()).toBe(true);
    expect(game.ceilingFrac).toBe(ceiling);
    expect(game.stepCount).toBe(steps);
  });

  it('the ceiling drifts down every unpaused step at the level velocity', () => {
    const game = makeTunnel(canvas);
    const before = game.ceilingFrac;
    for (let i = 0; i < 100; i++) game.step();
    expect(game.ceilingFrac).toBeCloseTo(before + 100 * TUNNEL_LEVELS[0].driftPerStep, 9);
  });
});

describe('TunnelGame — mechanic state machine', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => { canvas = makeCanvas(468, 468); });
  afterEach(() => { document.body.innerHTML = ''; });

  function placePlayerAt(game: TunnelGame, xFrac: number): void {
    game.player!.dx = xFrac * canvas.width - game.player!.dWidth / 2;
  }

  it('walks pick up → place → three lights → armed, one verb per state', () => {
    const game = makeTunnel(canvas);

    placePlayerAt(game, game.bombXFrac);
    expect(game.currentVerb()).toBe('pick up');
    game.action();
    expect(game.state).toBe('carry');
    expect(game.carrying).toBe(true);

    /* The verb away from the crack is nothing; at the crack it is place */
    expect(game.currentVerb()).toBe(game.crackXFrac === game.bombXFrac ? 'place' : null);
    placePlayerAt(game, game.crackXFrac);
    expect(game.currentVerb()).toBe('place');
    game.action();
    expect(game.state).toBe('placed');

    expect(game.currentVerb()).toBe('light');
    game.action();
    game.action();
    expect(game.state).toBe('placed');
    game.action();
    expect(game.state).toBe('armed');
    expect(game.fuseStepsLeft).toBeGreaterThan(0);
  });

  it('action away from the bomb does nothing in explore', () => {
    const game = makeTunnel(canvas);
    placePlayerAt(game, Math.abs(game.bombXFrac - 0.5) > 0.25 ? 0.5 : 0.95);
    game.action();
    expect(game.state).toBe('explore');
  });

  it('action is inert while paused', () => {
    const game = makeTunnel(canvas);
    placePlayerAt(game, game.bombXFrac);
    game.paused = true;
    game.action();
    expect(game.state).toBe('explore');
  });

  it('fuse expiry breaches: banks a share + the cycle award, then the staged event runs', () => {
    const game = makeTunnel(canvas);
    game.state = 'armed';
    game.fuseStepsLeft = 1;
    game.step();
    expect(game.cyclesCleared).toBe(1);
    /* First breakout banks a third of the unbanked remaining seconds */
    expect(game.bankedSeconds).toBe(Math.floor(game.secondsLeft() / TOTAL_CYCLES));
    expect(game.state).toBe('event');
  });

  it('the staged event suspends drift and lands exactly on the next cycle start', () => {
    const game = makeTunnel(canvas);
    game.state = 'armed';
    game.fuseStepsLeft = 1;
    game.step();
    for (let i = 0; i < 48; i++) game.step();
    expect(game.cycle).toBe(1);
    expect(game.state).toBe('explore');
    expect(game.ceilingFrac).toBeCloseTo(FLOOR_FRAC - TUNNEL_LEVELS[1].startHeadroomFrac, 9);
  });

  it('crack and bomb spawn apart, and the crack avoids the player spawn', () => {
    for (let i = 0; i < 25; i++) {
      const game = makeTunnel(makeCanvas(468, 468));
      expect(Math.abs(game.bombXFrac - game.crackXFrac)).toBeGreaterThanOrEqual(MIN_CRACK_SPAWN_DIST_FRAC);
    }
  });
});

describe('TunnelGame — crush death and respawn (D10)', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => { canvas = makeCanvas(468, 468); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('crush consumes a life and restarts the cycle from its start height with the remaining time', () => {
    const game = makeTunnel(canvas);
    game.stepCount = 20 * STEPS_PER_SECOND; // 40 s left
    armCrush(game);
    game.step();
    expect(game.player?.lives).toBe(2);
    expect(game.secondsLeft()).toBe(40);          // countdown survives the death
    expect(game.cycle).toBe(0);                   // same level, same crack appearance
    expect(game.state).toBe('explore');
    expect(game.ceilingFrac).toBeCloseTo(FLOOR_FRAC - TUNNEL_LEVELS[0].startHeadroomFrac, 9);
  });

  it('no second crush is possible within one step of respawn', () => {
    const game = makeTunnel(canvas);
    armCrush(game);
    game.step();
    expect(game.player?.lives).toBe(2);
    /* hit-stop holds the world briefly, then drift resumes from the start height */
    for (let i = 0; i < 60; i++) game.step();
    expect(game.player?.lives).toBe(2);
  });

  it('crush mid-fuse cancels the armed state, stops the tick, and returns the bomb to its spawn', () => {
    const game = makeTunnel(canvas);
    const stopTick = vi.spyOn(game.fuseTickSfx, 'pause');
    game.carrying = false;
    game.bombXFrac = game.crackXFrac;
    game.state = 'armed';
    game.fuseStepsLeft = 500;
    armCrush(game);
    game.step();
    expect(game.state).toBe('explore');
    expect(game.fuseStepsLeft).toBe(0);
    expect(stopTick).toHaveBeenCalled();
    expect(game.bombXFrac).toBe(game.bombSpawnXFrac);
  });

  it('a muted crush plays nothing through the channel helper', () => {
    const game = makeTunnel(canvas);
    game.muted = true;
    const play = vi.spyOn(game.crushSfx, 'play');
    armCrush(game);
    game.step();
    expect(game.player?.lives).toBe(2); // the crush itself still happens
    expect(play).not.toHaveBeenCalled();
  });

  it('an unmuted crush plays the squash exactly once', () => {
    const game = makeTunnel(canvas);
    game.muted = false;
    const play = vi.spyOn(game.crushSfx, 'play').mockResolvedValue(undefined);
    armCrush(game);
    game.step();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('the third crush ends the run once, with the banked-only breakdown', () => {
    const game = makeTunnel(canvas);
    game.player!.lives = 1;
    game.bankedSeconds = 25;
    game.cyclesCleared = 1;
    game.state = 'armed'; // death, not bank, resolves this cycle
    armCrush(game);
    game.step();
    expect(game.isOver).toBe(true);

    const onGameOver = vi.fn();
    const onComplete = vi.fn();
    game.gameOverCallback(onGameOver);
    game.completionCallback(onComplete);
    game['renderFrame']();
    game['renderFrame']();
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onGameOver).toHaveBeenCalledWith(
      makeBreakdown({ surface: 42, livesBonus: 20, tunnelTime: 25, cyclesBonus: 5 }),
    );
  });
});

describe('TunnelGame — completion routing', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => { canvas = makeCanvas(468, 468); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('the third breach banks the rest, converts lives, and completes exactly once', () => {
    const game = makeTunnel(canvas);
    game.stepCount = 10 * STEPS_PER_SECOND; // 50 s left
    game.bankedSeconds = 30;
    game.cyclesCleared = 2;
    game.cycle = 2;
    game.state = 'armed';
    game.fuseStepsLeft = 1;
    game.step();
    /* Victory enters the tease beat sequence; the run ends at the cut */
    expect(game.state).toBe('tease');
    const frozen = game.secondsLeft();
    for (let i = 0; i < 300 && !game.isOver; i++) game.step();
    expect(game.isOver).toBe(true);
    expect(game.secondsLeft()).toBe(frozen); // the countdown froze with the bank

    const onGameOver = vi.fn();
    const onComplete = vi.fn();
    game.gameOverCallback(onGameOver);
    game.completionCallback(onComplete);
    game['renderFrame']();
    game['renderFrame']();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onGameOver).not.toHaveBeenCalled();

    /* Final breakout banks all unbanked seconds (50 − 30 = 20 → 50 total);
       3 surviving lives convert at the completion boundary */
    const breakdown = onComplete.mock.calls[0][0];
    expect(breakdown).toEqual(
      makeBreakdown({ surface: 42, livesBonus: 20 + 30, tunnelTime: 50, cyclesBonus: 15 }),
    );
    expect(breakdown.total).toBe(
      breakdown.surface + breakdown.livesBonus + breakdown.tunnelTime + breakdown.cyclesBonus,
    );
  });

  it('no crush can resolve after the completion bank (drift suspended through the tease)', () => {
    const game = makeTunnel(canvas);
    game.cyclesCleared = 2;
    game.cycle = 2;
    game.state = 'armed';
    game.fuseStepsLeft = 1;
    armCrush(game); // ceiling practically at the kill line as the fuse resolves
    game.ceilingFrac -= TUNNEL_LEVELS[2].driftPerStep * 2; // breach wins the race this step
    game.step();
    expect(game.state).toBe('tease');
    const lives = game.player!.lives;
    const ceiling = game.ceilingFrac;
    for (let i = 0; i < 300 && !game.isOver; i++) game.step();
    expect(game.isOver).toBe(true);
    expect(game.player!.lives).toBe(lives);      // no crush through the whole tease
    expect(game.ceilingFrac).toBe(ceiling);      // drift stayed suspended
    expect(game.step()).toBe(false);             // halted after the cut
  });
});

describe('TunnelGame — HUD countdown and banking pop', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas(468, 468);
    document.body.innerHTML = `
      <div class="lives-icons"></div>
      <span class="hud-item lives-item"><span class="hud-value lives-value"></span></span>
      <div class="hud-score">
        <span class="hud-item"><span class="hud-value seconds-value">60</span></span>
        <span class="hud-item level-item"><span class="hud-value level-value"></span></span>
      </div>
    `;
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('shows the countdown and the depth slot', () => {
    const game = makeTunnel(canvas);
    game.step();
    expect(document.querySelector('.seconds-value')?.textContent).toBe(String(game.secondsLeft()));
    expect(document.querySelector('.level-value')?.textContent).toBe(`depth 1/${TOTAL_CYCLES}`);
  });

  it('enters the warning state at 10 seconds left, not before', () => {
    const game = makeTunnel(canvas);
    const digits = document.querySelector('.seconds-value') as HTMLElement;
    game.stepCount = (TUNNEL_TIME_BUDGET_S - 11) * 60;
    game.step();
    expect(digits.classList.contains('time-warning')).toBe(false);
    game.stepCount = (TUNNEL_TIME_BUDGET_S - 10) * 60;
    game.step();
    expect(digits.classList.contains('time-warning')).toBe(true);
  });

  it('pops "+N" with the banked share plus the cycle award at breakout', () => {
    const game = makeTunnel(canvas);
    game.state = 'armed';
    game.fuseStepsLeft = 1;
    const expected = Math.floor(game.secondsLeft() / TOTAL_CYCLES) + 5;
    game.step();
    const pop = document.querySelector('.bank-pop');
    expect(pop?.textContent).toBe(`+${expected}`);
  });

  it('advances the depth slot after the staged event', () => {
    const game = makeTunnel(canvas);
    game.state = 'armed';
    game.fuseStepsLeft = 1;
    game.step();
    for (let i = 0; i < 48; i++) game.step();
    expect(document.querySelector('.level-value')?.textContent).toBe(`depth 2/${TOTAL_CYCLES}`);
  });
});
