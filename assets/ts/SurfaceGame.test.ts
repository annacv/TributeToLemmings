import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SurfaceGame } from './SurfaceGame';
import { Player } from './Player';
import { Bomb } from './Bomb';
import { SPRITES } from './assets';
import { makeBreakdown, LEVEL_POINTS } from './lib/score';
import { MAX_CATCHUP_STEPS } from './lib/GameLoop';
import { makeCanvas } from './test-helpers';

// --- helpers ---

function makeSurfaceGameWithPlayer(canvas: HTMLCanvasElement) {
  const game = new SurfaceGame(canvas);
  game.player = new Player(canvas);
  return game as SurfaceGame & { player: Player };
}

function placeBomb(game: SurfaceGame, dx: number, dy = 390): Bomb {
  const bomb = new Bomb(game.canvas, dx);
  bomb.dy = dy;
  game.bombs.push(bomb);
  game.checkCollisions();
  return bomb;
}

function placeHitBomb(game: SurfaceGame, dx = 50): Bomb {
  return placeBomb(game, dx);
}

function runFrames(game: SurfaceGame, frames = 6): void {
  for (let i = 0; i < frames; i++) game.update();
}

function setupHud(iconCount = 3): void {
  const icons = Array.from({ length: iconCount }, () => '<img class="life-icon" alt="" />').join('\n        ');
  document.body.innerHTML = `
    <div class="lives-icons">${icons}</div>
    <span class="hud-item lives-item">
      <span class="hud-label">lives</span>
      <span class="hud-value lives-value"></span>
    </span>
  `;
}

// --- tests ---

describe('SurfaceGame', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps exploding bombs visible until removal', () => {
    const game = makeSurfaceGameWithPlayer(canvas);
    const bomb = placeHitBomb(game);

    expect(bomb.isExploding).toBe(true);
    expect(bomb.explosionStepsLeft).toBe(6);
    expect(bomb.image.src).toContain(SPRITES.booom);
    expect(game.bombs).toHaveLength(1);
    expect(game.player.lives).toBe(3);

    runFrames(game, 5);
    expect(game.bombs).toHaveLength(1);
    expect(game.player.lives).toBe(3);

    game.update();
    expect(game.bombs).toHaveLength(0);
    expect(game.player.lives).toBe(2);
  });

  it('registers all overlapping bomb hits in the same frame', () => {
    const game = makeSurfaceGameWithPlayer(canvas);
    placeHitBomb(game, 50);
    placeHitBomb(game, 60);

    runFrames(game);

    expect(game.player.lives).toBe(1);
    expect(game.bombs).toHaveLength(0);
  });

  /* Hurtbox geometry on the 468×468 test canvas: player box (40,380) 50×50
     → hurtbox x 48–82, y 385–430; bomb 28×32 with the right 6px (spark) trimmed
     → dangerous span dx..dx+22. */

  it.each([
    { dx: 83, dy: 390, hit: false, note: 'body just past the hurtbox right edge (82)' },
    { dx: 25, dy: 390, hit: false, note: 'only the trimmed spark zone (47–53) reaches the player' },
    { dx: 50, dy: 352, hit: false, note: 'bomb bottom (384) just above the hurtbox top (385)' },
    { dx: 82, dy: 390, hit: true,  note: 'body left edge touches hurtbox right edge' },
    { dx: 26, dy: 390, hit: true,  note: 'body right edge (48) touches hurtbox left edge' },
  ])('hurtbox boundary: bomb at ($dx,$dy) → hit=$hit ($note)', ({ dx, dy, hit }) => {
    const game = makeSurfaceGameWithPlayer(canvas);
    expect(placeBomb(game, dx, dy).isExploding).toBe(hit);
  });

  it('collision outcome is independent of facing direction', () => {
    // The sprite mirrors with direction but the hurtbox must not: facing
    // left or right at the same position must give the same outcome.
    for (const [dx, expected] of [[82, true], [83, false]] as const) {
      for (const direction of [1, -1]) {
        const game = makeSurfaceGameWithPlayer(canvas);
        game.player.direction = direction;
        expect(placeBomb(game, dx).isExploding).toBe(expected);
      }
    }
  });

  it('sets isOver when last life is lost', () => {
    const game = makeSurfaceGameWithPlayer(canvas);
    game.player.lives = 1;
    placeHitBomb(game);

    runFrames(game);

    expect(game.player.lives).toBe(0);
    expect(game.isOver).toBe(true);
  });

  it('a surface death scores only completed levels, never the level died on', () => {
    const game = makeSurfaceGameWithPlayer(canvas);
    const onGameOver = vi.fn();
    game.gameOverCallback(onGameOver);
    game.score = 40;
    game.currentLevel = 2;
    game.player.lives = 1;

    placeHitBomb(game);
    runFrames(game);
    expect(game.isOver).toBe(true);

    game['host']['frame']();
    game['host']['frame']();

    expect(onGameOver).toHaveBeenCalledWith(
      makeBreakdown({ surfaceTime: 40, levelsBonus: 2 * LEVEL_POINTS }),
    );
  });

  it('uses pre-loop lives color when multiple bombs expire in one frame', () => {
    const game = makeSurfaceGameWithPlayer(canvas);
    placeHitBomb(game, 50);
    placeHitBomb(game, 60);

    runFrames(game);

    expect(game.player.blinkColor).toBe('#FFFFFF');
    expect(game.player.blinkStepsLeft).toBe(30);
  });

  it('displayLives does not throw when lives drop below zero', () => {
    const game = makeSurfaceGameWithPlayer(canvas);
    game.player.lives = -1;
    setupHud();

    expect(() => game.displayLives()).not.toThrow();
    expect(document.querySelectorAll('.life-losing')).toHaveLength(3);
  });

  it('plays bombHit from currentTime=0 on collision when unmuted', () => {
    const game = makeSurfaceGameWithPlayer(canvas);
    const bombHit = game.sfx.get('bombHit')!;
    const playSpy = vi.fn().mockResolvedValue(undefined);
    bombHit.play = playSpy;
    game.gameSong.muted = false;

    placeHitBomb(game);

    expect(bombHit.currentTime).toBe(0);
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('does not play bombHit when audio is muted', () => {
    const game = makeSurfaceGameWithPlayer(canvas);
    const bombHit = game.sfx.get('bombHit')!;
    const playSpy = vi.fn().mockResolvedValue(undefined);
    bombHit.play = playSpy;
    game.gameSong.muted = true;

    placeHitBomb(game);

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('removes all excess life icons when multiple lives are lost at once', () => {
    const game = makeSurfaceGameWithPlayer(canvas);
    game.player.lives = 1;
    setupHud();

    game.displayLives();

    expect(document.querySelectorAll('.life-losing')).toHaveLength(2);
  });
});

// ── Iteration IV: Level Progression & Ground Erosion ──────────────────────────

describe('SurfaceGame — level system', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => { canvas = makeCanvas(); });

  it.each([
    { from: 0, score: 17, to: 0 },   // below threshold → no advance
    { from: 0, score: 18, to: 1 },   // reaches level 2
    { from: 1, score: 36, to: 2 },   // reaches level 3
    { from: 2, score: 9999, to: 2 }, // never past level 3
  ])('checkLevelUp: level $from at score $score → level $to', ({ from, score, to }) => {
    const game = new SurfaceGame(canvas);
    game.currentLevel = from;
    game.score = score;
    game['checkLevelUp']();
    expect(game.currentLevel).toBe(to);
  });

  it('resets lastSpawnFrame on level-up', () => {
    const game = new SurfaceGame(canvas);
    game.count = 1080;
    game.lastSpawnFrame = 960;
    game.score = 18;
    game['checkLevelUp']();
    expect(game.lastSpawnFrame).toBe(1080);
  });

});

describe('SurfaceGame — ground erosion', () => {
  let canvas: HTMLCanvasElement;

function makeSurfaceGame() {
    const game = new SurfaceGame(canvas);
    game.player = new Player(canvas);
    return game;
  }

  beforeEach(() => { canvas = makeCanvas(); });

  it('activates ground erosion when level 3 starts', () => {
    const game = makeSurfaceGame();
    game.currentLevel = 1;
    game.score = 36;
    game['checkLevelUp']();
    expect(game.groundErosionActive).toBe(true);
  });

  it('does nothing to the ground while erosion is inactive (levels 1-2)', () => {
    const game = makeSurfaceGame();
    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();
    expect(game.erosionCounter).toBe(0);
    expect(game['renderer']['crackStamps']).toHaveLength(0);
    expect(game['renderer']['holeStamps']).toHaveLength(0);
  });

  it('increments erosionCounter each time a bomb exits at level 3', () => {
    const game = makeSurfaceGame();
    game.groundErosionActive = true;
    game.gameSong.muted = true;

    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();

    expect(game.erosionCounter).toBe(1);
  });

});

describe('SurfaceGame — per-hit ground feedback (cracks, holes, shake)', () => {
  let canvas: HTMLCanvasElement;

function makeSurfaceGame() {
    const game = new SurfaceGame(canvas);
    game.player = new Player(canvas);
    game.gameSong.muted = true;
    game.groundErosionActive = true;
    return game;
  }

  function dropBomb(game: SurfaceGame, dx = 100): Bomb {
    const bomb = new Bomb(canvas, dx);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();
    return bomb;
  }

  beforeEach(() => { canvas = makeCanvas(); });

  it('adds a crack stamp for each bomb that hits the ground', () => {
    const game = makeSurfaceGame();
    dropBomb(game);
    expect(game['renderer']['crackStamps']).toHaveLength(1);
    dropBomb(game);
    expect(game['renderer']['crackStamps']).toHaveLength(2);
  });

  it('progresses from cracks to holes as misses accumulate', () => {
    const game = makeSurfaceGame();
    // Below the hole threshold (LATE_CRACK_MISSES = 14): cracks only, no holes.
    for (let i = 0; i < 14; i++) dropBomb(game);
    expect(game['renderer']['crackStamps']).toHaveLength(14);
    expect(game['renderer']['holeStamps']).toHaveLength(0);
    // Past it: holes begin landing while a crack still stamps every miss.
    for (let i = 0; i < 5; i++) dropBomb(game);
    expect(game['renderer']['crackStamps']).toHaveLength(19);
    expect(game['renderer']['holeStamps']).toHaveLength(5);
  });

});

describe('SurfaceGame — tunnel world transition', () => {
  let canvas: HTMLCanvasElement;

function makeSurfaceGame() {
    const game = new SurfaceGame(canvas);
    game.player = new Player(canvas);
    game.gameSong.muted = true;
    game.groundErosionActive = true;
    return game;
  }

  beforeEach(() => { canvas = makeCanvas(); });

  it('collapse sets isOver and records the complete outcome (teardown skips onGameOver)', () => {
    const game = makeSurfaceGame();
    game['renderer']['coveredCells'].fill(true); // full coverage; next miss collapses it
    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();
    expect(game.isOver).toBe(true);
    expect(game['outcome']).toBe('complete');
  });

  it('fires onComplete callback (not onGameOver) after the muted hold elapses', () => {
    vi.useFakeTimers();
    const game = makeSurfaceGame();
    const onComplete = vi.fn();
    const onGameOver = vi.fn();
    game.completionCallback(onComplete);
    game.gameOverCallback(onGameOver);
    game['renderer']['coveredCells'].fill(true); // ground already at full coverage; next miss collapses it

    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();

    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onComplete).toHaveBeenCalledWith(
      makeBreakdown({ surfaceTime: game.score, levelsBonus: (game.currentLevel + 1) * LEVEL_POINTS }),
    );
    expect(onGameOver).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('falls back to onGameOver when onComplete is null (muted)', () => {
    vi.useFakeTimers();
    const game = makeSurfaceGame();
    const onGameOver = vi.fn();
    game.gameOverCallback(onGameOver);
    game['renderer']['coveredCells'].fill(true); // ground already at full coverage; next miss collapses it

    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();
    vi.advanceTimersByTime(500);

    expect(onGameOver).toHaveBeenCalledWith(
      makeBreakdown({ surfaceTime: game.score, levelsBonus: (game.currentLevel + 1) * LEVEL_POINTS }),
    );
    vi.useRealTimers();
  });

  it('collapses at 23/24 covered cells, not before', () => {
    const below = makeSurfaceGame();
    below['renderer']['coveredCells'].fill(true);
    below['renderer']['coveredCells'][0] = false;
    below['renderer']['coveredCells'][1] = false; // 22/24 ≈ 0.917 < 0.95
    const bombA = new Bomb(canvas, 100);
    bombA.dy = canvas.height + 1;
    below.bombs.push(bombA);
    below.update();
    expect(below.isOver).toBe(false);

    const game = makeSurfaceGame();
    game['renderer']['coveredCells'].fill(true);
    game['renderer']['coveredCells'][0] = false; // 23/24 ≈ 0.958 >= 0.95
    const bombB = new Bomb(canvas, 100);
    bombB.dy = canvas.height + 1;
    game.bombs.push(bombB);
    game.update();
    expect(game.isOver).toBe(true);
  });
});

describe('SurfaceGame — unmuted sting exit routes (seam-test gate)', () => {
  let canvas: HTMLCanvasElement;

  /* Unmuted: triggerTunnelWorld holds on the collapse sting and exits via
     whichever of ended/error/watchdog/play-rejection resolves first */
  function collapseUnmuted() {
    const game = new SurfaceGame(canvas);
    game.player = new Player(canvas);
    game.gameSong.muted = false;
    game.groundErosionActive = true;
    const onComplete = vi.fn();
    game.completionCallback(onComplete);
    game['renderer']['coveredCells'].fill(true);
    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();
    return { game, onComplete };
  }

  beforeEach(() => {
    canvas = makeCanvas();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires the callback exactly once when the sting ends', () => {
    const { game, onComplete } = collapseUnmuted();
    game.tentonSfx.dispatchEvent(new Event('ended'));
    game.tentonSfx.dispatchEvent(new Event('ended'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('fires the callback exactly once on a sting decode error', () => {
    const { game, onComplete } = collapseUnmuted();
    game.tentonSfx.dispatchEvent(new Event('error'));
    game.tentonSfx.dispatchEvent(new Event('ended'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('fires the callback exactly once via the watchdog when no media event arrives', () => {
    const { game, onComplete } = collapseUnmuted();
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect(onComplete).toHaveBeenCalledTimes(1);
    /* A late 'ended' after the watchdog must not double-fire */
    game.tentonSfx.dispatchEvent(new Event('ended'));
    vi.advanceTimersByTime(4000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('fires the callback exactly once when play() rejects', async () => {
    const game = new SurfaceGame(canvas);
    game.player = new Player(canvas);
    game.gameSong.muted = false;
    game.groundErosionActive = true;
    const onComplete = vi.fn();
    game.completionCallback(onComplete);
    game.tentonSfx.play = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    game['renderer']['coveredCells'].fill(true);
    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();

    await vi.advanceTimersByTimeAsync(0); // flush the rejection handler
    expect(onComplete).toHaveBeenCalledTimes(1);
    game.tentonSfx.dispatchEvent(new Event('ended'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('finalized breakdowns satisfy total === sum of parts', () => {
    const { game, onComplete } = collapseUnmuted();
    game.tentonSfx.dispatchEvent(new Event('ended'));
    const breakdown = onComplete.mock.calls[0][0];
    expect(breakdown.total).toBe(
      breakdown.surfaceTime + breakdown.tunnelTime + breakdown.levelsBonus,
    );
    expect(breakdown).toEqual(
      makeBreakdown({ surfaceTime: game.score, levelsBonus: (game.currentLevel + 1) * LEVEL_POINTS }),
    );
  });
});

describe('SurfaceGame — fixed-timestep score', () => {
  /* Captures rAF callbacks so the test drives Game's loop with chosen timestamps */
  function makeHarness() {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const game = new SurfaceGame(makeCanvas());
    game.gameSong.muted = true;
    game.startGame(); // synchronous first step → count is already 1 here
    return {
      game,
      pump(timestamp: number): void {
        callbacks.shift()?.(timestamp);
      },
    };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /* Cadences sit a hair above the exact refresh period so the 60th-step float
     boundary is decisively crossed instead of flaking at ulp precision */

  it('120 Hz: one real second yields exactly score +1 (~60 steps)', () => {
    const h = makeHarness();
    h.pump(1000); // anchors the clock, zero steps
    for (let i = 1; i <= 120; i++) h.pump(1000 + i * 8.34);
    expect(h.game.score).toBe(1);
    expect(h.game.count).toBe(61); // 1 synchronous + 60 stepped
  });

  it('30 Hz: one real second still yields exactly score +1 (~2 steps per callback)', () => {
    const h = makeHarness();
    h.pump(1000);
    for (let i = 1; i <= 30; i++) h.pump(1000 + i * 33.4);
    expect(h.game.score).toBe(1);
    expect(h.game.count).toBe(61);
  });

  it('a long tab-stall does not inflate score by the discarded time (clamped catch-up)', () => {
    const h = makeHarness();  // synchronous first step → count 1
    h.pump(1000);                  // anchor the clock, 0 steps
    h.pump(1000 + 60_000);         // a 60 s stall, delivered in a single frame
    /* The ~3600 discarded steps are clamped to the catch-up budget, so the run
       advances at most MAX_CATCHUP_STEPS — the stall time never inflates the
       score or drains the countdown. */
    expect(h.game.count).toBe(1 + MAX_CATCHUP_STEPS);
    expect(h.game.score).toBe(0);
  });
});

describe('SurfaceGame — background-tab audio', () => {
  let canvas: HTMLCanvasElement;
  const callbacks: FrameRequestCallback[] = [];

  function setHidden(hidden: boolean): void {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    canvas = makeCanvas();
    callbacks.length = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    vi.unstubAllGlobals();
  });

  function startGameWithSpies() {
    const game = new SurfaceGame(canvas);
    game.gameSong.muted = true;
    const playSpy = vi.fn().mockResolvedValue(undefined);
    const pauseSpy = vi.fn();
    game.gameSong.play = playSpy;
    game.gameSong.pause = pauseSpy;
    game.startSong();
    game.startGame();
    playSpy.mockClear();
    pauseSpy.mockClear();
    return { game, playSpy, pauseSpy };
  }

  it('pauses the game song when the tab hides and resumes on return', () => {
    const { playSpy, pauseSpy } = startGameWithSpies();
    setHidden(true);
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    setHidden(false);
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('does not resume the song once the run has ended (dead instance stays silent)', () => {
    const { game, playSpy } = startGameWithSpies();
    game.isOver = true;
    callbacks.shift()?.(1000); // the halting render runs the teardown
    playSpy.mockClear();
    setHidden(true);
    setHidden(false);
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('runs the end-of-run teardown exactly once across extra post-halt frames', () => {
    const { game } = startGameWithSpies();
    const onGameOver = vi.fn();
    game.gameOverCallback(onGameOver);
    game.isOver = true;
    callbacks.shift()?.(1000);
    callbacks.shift()?.(1008);
    callbacks.shift()?.(1012);
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });
});
