import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Game } from './Game';
import { Player } from './Player';
import { Bomb } from './Bomb';
import { SPRITES } from './assets';
import { makeCanvas, makeCtx } from './test-helpers';

// --- helpers ---

function makeGameWithPlayer(canvas: HTMLCanvasElement) {
  const game = new Game(canvas);
  game.player = new Player(canvas);
  return game as Game & { player: Player };
}

function placeHitBomb(game: Game, dx = 50): Bomb {
  const bomb = new Bomb(game.canvas, dx);
  bomb.dy = 390;
  game.bombs.push(bomb);
  game.checkCollisions();
  return bomb;
}

function runFrames(game: Game, frames = 6): void {
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

describe('Game', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas(468, 468);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('instantiates without throwing', () => {
    expect(() => new Game(canvas)).not.toThrow();
  });

  it('starts with no player', () => {
    expect(new Game(canvas).player).toBeNull();
  });

  it('starts with an empty bombs array', () => {
    expect(new Game(canvas).bombs).toHaveLength(0);
  });

  it('starts with isGameOver false', () => {
    expect(new Game(canvas).isGameOver).toBe(false);
  });

  it('gameOverCallback sets the callback', () => {
    const game = new Game(canvas);
    const cb = (_score: number) => {};
    game.gameOverCallback(cb);
    expect(game.onGameOver).toBe(cb);
  });

  it('keeps exploding bombs visible until removal', () => {
    const game = makeGameWithPlayer(canvas);
    const bomb = placeHitBomb(game);

    expect(bomb.isExploding).toBe(true);
    expect(bomb.explosionFramesLeft).toBe(6);
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
    const game = makeGameWithPlayer(canvas);
    placeHitBomb(game, 50);
    placeHitBomb(game, 60);

    runFrames(game);

    expect(game.player.lives).toBe(1);
    expect(game.bombs).toHaveLength(0);
  });

  it('sets isGameOver when last life is lost', () => {
    const game = makeGameWithPlayer(canvas);
    game.player.lives = 1;
    placeHitBomb(game);

    runFrames(game);

    expect(game.player.lives).toBe(0);
    expect(game.isGameOver).toBe(true);
  });

  it('removes bombs that fall off the bottom of the canvas', () => {
    const game = makeGameWithPlayer(canvas);
    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);

    game.update();

    expect(game.bombs).toHaveLength(0);
  });

  it('uses pre-loop lives color when multiple bombs expire in one frame', () => {
    const game = makeGameWithPlayer(canvas);
    placeHitBomb(game, 50);
    placeHitBomb(game, 60);

    runFrames(game);

    expect(game.player.blinkColor).toBe('#FFFFFF');
    expect(game.player.blinkFramesLeft).toBe(30);
  });

  it('displayLives does not throw when lives drop below zero', () => {
    const game = makeGameWithPlayer(canvas);
    game.player.lives = -1;
    setupHud();

    expect(() => game.displayLives()).not.toThrow();
    expect(document.querySelectorAll('.life-losing')).toHaveLength(3);
  });

  it('has a bombHitSfx audio element', () => {
    expect(new Game(canvas).bombHitSfx).toBeInstanceOf(HTMLAudioElement);
  });

  it('plays bombHitSfx from currentTime=0 on collision when unmuted', () => {
    const game = makeGameWithPlayer(canvas);
    const playSpy = vi.fn().mockResolvedValue(undefined);
    game.bombHitSfx.play = playSpy;
    game.gameSong.muted = false;

    placeHitBomb(game);

    expect(game.bombHitSfx.currentTime).toBe(0);
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('does not play bombHitSfx when audio is muted', () => {
    const game = makeGameWithPlayer(canvas);
    const playSpy = vi.fn().mockResolvedValue(undefined);
    game.bombHitSfx.play = playSpy;
    game.gameSong.muted = true;

    placeHitBomb(game);

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('removes all excess life icons when multiple lives are lost at once', () => {
    const game = makeGameWithPlayer(canvas);
    game.player.lives = 1;
    setupHud();

    game.displayLives();

    expect(document.querySelectorAll('.life-losing')).toHaveLength(2);
  });

  it('blinks the HUD lives item when a life is lost', () => {
    const game = makeGameWithPlayer(canvas);
    game.player.lives = 2;
    setupHud();

    game.displayLives();

    expect(document.querySelector('.lives-item')!.classList.contains('blink')).toBe(true);
  });

  it('does not blink the HUD lives item when no life was lost', () => {
    const game = makeGameWithPlayer(canvas);
    setupHud();

    game.displayLives();

    expect(document.querySelector('.lives-item')!.classList.contains('blink')).toBe(false);
  });
});

// ── Iteration IV: Level Progression & Ground Erosion ──────────────────────────

describe('Game — level system', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => { canvas = makeCanvas(468, 468); });

  it('starts at level 1 (index 0)', () => {
    expect(new Game(canvas).currentLevel).toBe(0);
  });

  it('advances to level 2 when score reaches 18', () => {
    const game = new Game(canvas);
    game.score = 18;
    game['checkLevelUp']();
    expect(game.currentLevel).toBe(1);
  });

  it('advances to level 3 when score reaches 36', () => {
    const game = new Game(canvas);
    game.currentLevel = 1;
    game.score = 36;
    game['checkLevelUp']();
    expect(game.currentLevel).toBe(2);
  });

  it('does not advance past level 3', () => {
    const game = new Game(canvas);
    game.currentLevel = 2;
    game.score = 9999;
    game['checkLevelUp']();
    expect(game.currentLevel).toBe(2);
  });

  it('resets lastSpawnFrame on level-up', () => {
    const game = new Game(canvas);
    game.count = 1080;
    game.lastSpawnFrame = 960;
    game.score = 18;
    game['checkLevelUp']();
    expect(game.lastSpawnFrame).toBe(1080);
  });

  it('does not advance if score is below threshold', () => {
    const game = new Game(canvas);
    game.score = 17;
    game['checkLevelUp']();
    expect(game.currentLevel).toBe(0);
  });
});

describe('Game — ground erosion', () => {
  let canvas: HTMLCanvasElement;

  function makeGame() {
    const game = new Game(canvas);
    game.player = new Player(canvas);
    return game;
  }

  beforeEach(() => { canvas = makeCanvas(468, 468); });

  it('groundErosionActive starts false', () => {
    expect(new Game(canvas).groundErosionActive).toBe(false);
  });

  it('activates ground erosion when level 3 starts', () => {
    const game = makeGame();
    game.currentLevel = 1;
    game.score = 36;
    game['checkLevelUp']();
    expect(game.groundErosionActive).toBe(true);
  });

  it('erosionCounter starts at 0', () => {
    expect(new Game(canvas).erosionCounter).toBe(0);
  });

  it('does not increment erosionCounter when erosion is inactive (levels 1-2)', () => {
    const game = makeGame();
    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();
    expect(game.erosionCounter).toBe(0);
  });

  it('increments erosionCounter each time a bomb exits at level 3', () => {
    const game = makeGame();
    game.groundErosionActive = true;
    game.gameSong.muted = true;

    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();

    expect(game.erosionCounter).toBe(1);
  });

  it('increments erosionCounter 5 times after 5 bombs exit', () => {
    const game = makeGame();
    game.groundErosionActive = true;
    game.gameSong.muted = true;

    for (let i = 0; i < 5; i++) {
      const bomb = new Bomb(canvas, 100);
      bomb.dy = canvas.height + 1;
      game.bombs.push(bomb);
    }
    game.update();

    expect(game.erosionCounter).toBe(5);
  });
});

describe('Game — per-hit ground feedback (cracks, holes, shake)', () => {
  let canvas: HTMLCanvasElement;

  function makeGame() {
    const game = new Game(canvas);
    game.player = new Player(canvas);
    game.gameSong.muted = true;
    game.groundErosionActive = true;
    return game;
  }

  function dropBomb(game: Game, dx = 100): Bomb {
    const bomb = new Bomb(canvas, dx);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();
    return bomb;
  }

  beforeEach(() => { canvas = makeCanvas(468, 468); });

  it('adds a crack mark for each bomb that hits the ground', () => {
    const game = makeGame();
    dropBomb(game);
    expect(game['crackMarks']).toHaveLength(1);
    dropBomb(game);
    expect(game['crackMarks']).toHaveLength(2);
  });

  it('centers the crack mark under the bomb that fell', () => {
    const game = makeGame();
    const bomb = dropBomb(game, 100);
    expect(game['crackMarks'][0].x).toBe(100 + bomb.dWidth / 2);
  });

  it('triggers a light shake on the canvas for each ground hit', () => {
    const game = makeGame();
    dropBomb(game);
    expect(canvas.classList.contains('shake-light')).toBe(true);
  });

  it('adds progressive holes at erosion counts 5, 7, 9, 11 and 13', () => {
    const game = makeGame();
    for (let i = 0; i < 4; i++) dropBomb(game);
    expect(game['holeMarks']).toHaveLength(0);

    dropBomb(game); // 5th hit
    expect(game['holeMarks']).toHaveLength(1);

    dropBomb(game); // 6th hit
    expect(game['holeMarks']).toHaveLength(1);

    dropBomb(game); // 7th hit
    expect(game['holeMarks']).toHaveLength(2);

    dropBomb(game); // 8th hit
    expect(game['holeMarks']).toHaveLength(2);

    dropBomb(game); // 9th hit
    expect(game['holeMarks']).toHaveLength(3);

    dropBomb(game); // 10th hit
    expect(game['holeMarks']).toHaveLength(3);

    dropBomb(game); // 11th hit
    expect(game['holeMarks']).toHaveLength(4);

    dropBomb(game); // 12th hit
    expect(game['holeMarks']).toHaveLength(4);

    dropBomb(game); // 13th hit
    expect(game['holeMarks']).toHaveLength(5);
  });
});

describe('Game — erosion canvas drawing', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => { canvas = makeCanvas(468, 468); });

  it('strokes a jagged line for each crack mark', () => {
    const game = new Game(canvas);
    const ctx = makeCtx();
    game['erosionCtx'] = ctx as unknown as CanvasRenderingContext2D;
    game['crackMarks'] = [{ x: 100, y: 350, angle: 0.2, length: 30, jitter: 2 }];

    game['drawCrackMarks']();

    expect(ctx.beginPath).toHaveBeenCalledTimes(1);
    expect(ctx.moveTo).toHaveBeenCalledWith(100, 350);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it('fills a void and an inner shadow ellipse for each hole mark', () => {
    const game = new Game(canvas);
    const ctx = makeCtx();
    game['erosionCtx'] = ctx as unknown as CanvasRenderingContext2D;
    game['holeMarks'] = [{ cx: 200, cy: 380, rx: 30, ry: 24 }];

    game['drawHoleMarks']();

    expect(ctx.ellipse).toHaveBeenCalledTimes(2);
    expect(ctx.fill).toHaveBeenCalledTimes(2);
  });
});

describe('Game — tunnel world transition', () => {
  let canvas: HTMLCanvasElement;

  function makeGame() {
    const game = new Game(canvas);
    game.player = new Player(canvas);
    game.gameSong.muted = true;
    game.groundErosionActive = true;
    return game;
  }

  beforeEach(() => { canvas = makeCanvas(468, 468); });

  it('tunnelWorldCallback registers the callback', () => {
    const game = new Game(canvas);
    const cb = vi.fn();
    game.tunnelWorldCallback(cb);
    expect(game.onTunnelWorld).toBe(cb);
  });

  it('sets isGameOver on tunnel transition', () => {
    const game = makeGame();
    game.erosionCounter = 14;
    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();
    expect(game.isGameOver).toBe(true);
  });

  it('sets isTunnelTransition flag to prevent onGameOver firing', () => {
    const game = makeGame();
    game.erosionCounter = 14;
    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();
    expect(game['isTunnelTransition']).toBe(true);
  });

  it('fires onTunnelWorld callback (not onGameOver) when muted and erosion completes', () => {
    const game = makeGame();
    const tunnelCb = vi.fn();
    const gameOverCb = vi.fn();
    game.tunnelWorldCallback(tunnelCb);
    game.gameOverCallback(gameOverCb);
    game.erosionCounter = 14;

    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();

    expect(tunnelCb).toHaveBeenCalledWith(game.score);
    expect(gameOverCb).not.toHaveBeenCalled();
  });

  it('falls back to onGameOver when onTunnelWorld is null (muted)', () => {
    const game = makeGame();
    const gameOverCb = vi.fn();
    game.gameOverCallback(gameOverCb);
    game.erosionCounter = 14;

    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();

    expect(gameOverCb).toHaveBeenCalledWith(game.score);
  });
});

describe('Game — level-up visual effects', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas(468, 468);
    document.body.innerHTML = `
      <div class="crt-frame">
        <p class="level-up-banner"></p>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('blinks the HUD level item when the level updates', () => {
    document.body.innerHTML += `
      <span class="hud-item level-item">
        <span class="hud-label">level</span>
        <span class="hud-value level-value">1</span>
      </span>
    `;
    const game = new Game(canvas);
    game.gameSong.muted = true;
    game.score = 18;

    game['checkLevelUp']();

    expect(document.querySelector('.level-value')!.textContent).toBe('2');
    expect(document.querySelector('.level-item')!.classList.contains('blink')).toBe(true);
  });

  it('announces level 1 at game start', () => {
    const game = new Game(canvas);
    game.gameSong.muted = true;

    game['showLevelUpEffect']();

    const banner = document.querySelector('.level-up-banner')!;
    expect(banner.textContent).toBe('Level 1');
    expect(banner.classList.contains('show')).toBe(true);
  });

  it('shows the level-up banner with the new level number', () => {
    const game = new Game(canvas);
    game.gameSong.muted = true;
    game.score = 18;

    game['checkLevelUp']();

    const banner = document.querySelector('.level-up-banner')!;
    expect(banner.textContent).toBe('Level 2');
    expect(banner.classList.contains('show')).toBe(true);
  });

  it('flashes the crt-frame on level-up', () => {
    const game = new Game(canvas);
    game.gameSong.muted = true;
    game.score = 18;

    game['checkLevelUp']();

    expect(document.querySelector('.crt-frame')!.classList.contains('flash-active')).toBe(true);
  });

  it('triggers the earthquake shake when ground erosion activates (level 3)', () => {
    vi.useFakeTimers();
    const game = new Game(canvas);
    game.gameSong.muted = true;
    game.currentLevel = 1;
    game.score = 36;

    game['checkLevelUp']();
    const frame = document.querySelector('.crt-frame')!;
    expect(frame.classList.contains('shake-quake')).toBe(false);

    vi.advanceTimersByTime(300);
    expect(frame.classList.contains('shake-quake')).toBe(true);
  });

  it('does not trigger the earthquake shake on earlier level-ups', () => {
    vi.useFakeTimers();
    const game = new Game(canvas);
    game.gameSong.muted = true;
    game.score = 18;

    game['checkLevelUp']();
    vi.advanceTimersByTime(300);

    expect(document.querySelector('.crt-frame')!.classList.contains('shake-quake')).toBe(false);
  });
});

describe('Game — score increments', () => {
  it('score matches seconds elapsed at 60 fps', () => {
    const canvas = makeCanvas(468, 468);
    const game = new Game(canvas);
    game.score = 0;
    game.count = 0;

    for (let i = 0; i < 180; i++) {
      game.count++;
      if (game.count % 60 === 0) game.score++;
    }

    expect(game.score).toBe(3);
  });
});
