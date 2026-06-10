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

  it('does not stamp cracks or holes while erosion is inactive', () => {
    const game = makeGame();
    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();
    expect(game['crackStamps']).toHaveLength(0);
    expect(game['holeStamps']).toHaveLength(0);
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

  it('adds a crack stamp for each bomb that hits the ground', () => {
    const game = makeGame();
    dropBomb(game);
    expect(game['crackStamps']).toHaveLength(1);
    dropBomb(game);
    expect(game['crackStamps']).toHaveLength(2);
  });

  it('centers the crack stamp under the bomb that fell', () => {
    const game = makeGame();
    const bomb = dropBomb(game, 100);
    const stamp = game['crackStamps'][0];
    expect(stamp.x + stamp.w / 2).toBeCloseTo(100 + bomb.dWidth / 2);
  });

  it('triggers a light shake on the canvas for each ground hit', () => {
    const game = makeGame();
    dropBomb(game);
    expect(canvas.classList.contains('shake-light')).toBe(true);
  });

  it('stamps only crack-mark-1/2 during the first four misses', () => {
    const game = makeGame();
    for (let i = 0; i < 4; i++) dropBomb(game);
    const cracks = game['crackStamps'];
    expect(cracks).toHaveLength(4);
    expect(game['holeStamps']).toHaveLength(0);
    expect(cracks[0].img).toBe(game['crackImgs'][0]);
    expect(cracks[1].img).toBe(game['crackImgs'][1]);
    expect(cracks[2].img).toBe(game['crackImgs'][0]);
    expect(cracks[3].img).toBe(game['crackImgs'][1]);
  });

  it('stamps only crack-mark-3/4 during misses five to eight', () => {
    const game = makeGame();
    for (let i = 0; i < 8; i++) dropBomb(game);
    const cracks = game['crackStamps'];
    expect(cracks).toHaveLength(8);
    expect(game['holeStamps']).toHaveLength(0);
    expect(cracks[4].img).toBe(game['crackImgs'][2]);
    expect(cracks[5].img).toBe(game['crackImgs'][3]);
    expect(cracks[6].img).toBe(game['crackImgs'][2]);
    expect(cracks[7].img).toBe(game['crackImgs'][3]);
  });

  it('stamps holes (cycling all four variants) from the fifteenth miss on', () => {
    const game = makeGame();
    for (let i = 0; i < 14; i++) dropBomb(game);
    expect(game['holeStamps']).toHaveLength(0);
    for (let i = 0; i < 5; i++) dropBomb(game);
    const holes = game['holeStamps'];
    expect(holes).toHaveLength(5);
    expect(holes[0].img).not.toBe(holes[1].img);
    expect(holes[4].img).toBe(holes[0].img);
  });

  it('stamps a crack at every miss, even once holes are landing', () => {
    const game = makeGame();
    for (let i = 0; i < 17; i++) dropBomb(game);
    const cracks = game['crackStamps'];
    expect(cracks).toHaveLength(17);
    // hole-phase misses keep using the heavy pair (crack-mark-3/4)
    expect(cracks[16].img).toBe(game['crackImgs'][2 + (16 % 2)]);
  });

  it('keeps stamps inside the ground band', () => {
    const game = makeGame();
    for (let i = 0; i < 10; i++) dropBomb(game, i % 2 === 0 ? 0 : canvas.width - 10);
    for (const stamp of [...game['crackStamps'], ...game['holeStamps']]) {
      expect(stamp.x).toBeGreaterThanOrEqual(0);
      expect(stamp.x + stamp.w).toBeLessThanOrEqual(canvas.width);
      expect(stamp.y).toBeGreaterThanOrEqual(canvas.height * 0.71);
      expect(stamp.y + stamp.h).toBeLessThanOrEqual(canvas.height);
    }
  });

  it('grows ground coverage once holes start landing', () => {
    const game = makeGame();
    for (let i = 0; i < 14; i++) dropBomb(game);
    expect(game['groundCoverage']()).toBe(0);
    dropBomb(game); // 15th miss: first hole
    expect(game['groundCoverage']()).toBeGreaterThan(0);
  });
});

describe('Game — erosion canvas drawing', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => { canvas = makeCanvas(468, 468); });

  it('draws each loaded stamp onto the erosion canvas', () => {
    const game = new Game(canvas);
    const ctx = makeCtx();
    game['erosionCtx'] = ctx as unknown as CanvasRenderingContext2D;
    const img = { complete: true } as HTMLImageElement;
    game['crackStamps'] = [{ img, x: 100, y: 350, w: 30, h: 90 }];

    game['drawStamps'](game['crackStamps']);

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledWith(img, 100, 350, 30, 90);
  });

  it('skips stamps whose image has not loaded yet', () => {
    const game = new Game(canvas);
    const ctx = makeCtx();
    game['erosionCtx'] = ctx as unknown as CanvasRenderingContext2D;
    const img = { complete: false } as HTMLImageElement;
    game['holeStamps'] = [{ img, x: 50, y: 360, w: 80, h: 48 }];

    game['drawStamps'](game['holeStamps']);

    expect(ctx.drawImage).not.toHaveBeenCalled();
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
    game['coveredCells'].fill(true); // ground already at full coverage; next miss collapses it
    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);
    game.update();
    expect(game.isGameOver).toBe(true);
  });

  it('sets isTunnelTransition flag to prevent onGameOver firing', () => {
    const game = makeGame();
    game['coveredCells'].fill(true); // ground already at full coverage; next miss collapses it
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
    game['coveredCells'].fill(true); // ground already at full coverage; next miss collapses it

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
    game['coveredCells'].fill(true); // ground already at full coverage; next miss collapses it

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
