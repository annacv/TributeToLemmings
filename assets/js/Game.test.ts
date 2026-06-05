import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Game } from './Game';
import { Player } from './Player';
import { Bomb } from './Bomb';
import { SPRITES } from './assets';

function makeCtx() {
  return {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
}

describe('Game', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 468;
    canvas.height = 468;
    canvas.getContext = vi.fn().mockReturnValue(makeCtx()) as typeof canvas.getContext;
    (global as unknown as Record<string, unknown>).Path2D = class {
      moveTo() {} lineTo() {} closePath() {} rect() {}
    };
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
    const game = new Game(canvas);
    game.player = new Player(canvas);

    const bomb = new Bomb(canvas, 50);
    bomb.dy = 390;
    game.bombs.push(bomb);
    game.checkCollisions();

    expect(bomb.isExploding).toBe(true);
    expect(bomb.explosionFramesLeft).toBe(6);
    expect(bomb.image.src).toContain(SPRITES.booom);
    expect(game.bombs).toHaveLength(1);
    expect(game.player.lives).toBe(3);

    for (let frame = 0; frame < 5; frame++) {
      game.update();
      expect(game.bombs).toHaveLength(1);
      expect(game.player.lives).toBe(3);
    }

    game.update();

    expect(game.bombs).toHaveLength(0);
    expect(game.player.lives).toBe(2);
  });

  it('registers all overlapping bomb hits in the same frame', () => {
    const game = new Game(canvas);
    game.player = new Player(canvas);

    const bomb1 = new Bomb(canvas, 50);
    bomb1.dy = 390;
    const bomb2 = new Bomb(canvas, 60);
    bomb2.dy = 395;

    game.bombs.push(bomb1, bomb2);
    game.checkCollisions();

    for (let frame = 0; frame < 6; frame++) {
      game.update();
    }

    expect(game.player.lives).toBe(1);
    expect(game.bombs).toHaveLength(0);
  });

  it('sets isGameOver when last life is lost', () => {
    const game = new Game(canvas);
    game.player = new Player(canvas);
    game.player.lives = 1;

    const bomb = new Bomb(canvas, 50);
    bomb.dy = 390;
    game.bombs.push(bomb);
    game.checkCollisions();

    for (let frame = 0; frame < 6; frame++) {
      game.update();
    }

    expect(game.player.lives).toBe(0);
    expect(game.isGameOver).toBe(true);
  });

  it('removes bombs that fall off the bottom of the canvas', () => {
    const game = new Game(canvas);
    game.player = new Player(canvas);

    const bomb = new Bomb(canvas, 100);
    bomb.dy = canvas.height + 1;
    game.bombs.push(bomb);

    game.update();

    expect(game.bombs).toHaveLength(0);
  });

  it('uses pre-loop lives color when multiple bombs expire in one frame', () => {
    const game = new Game(canvas);
    game.player = new Player(canvas);

    const bomb1 = new Bomb(canvas, 50);
    bomb1.dy = 390;
    const bomb2 = new Bomb(canvas, 60);
    bomb2.dy = 395;

    game.bombs.push(bomb1, bomb2);
    game.checkCollisions();

    for (let frame = 0; frame < 6; frame++) {
      game.update();
    }

    // started at 3 lives (white), both expired same frame — blinkColor must be white
    expect(game.player.blinkColor).toBe('#FFFFFF');
    // single blink triggered: blinkFramesLeft should be exactly 30, not doubled or partial
    expect(game.player.blinkFramesLeft).toBe(30);
  });

  it('displayLives does not throw when lives drop below zero', () => {
    const game = new Game(canvas);
    game.player = new Player(canvas);
    game.player.lives = -1;

    document.body.innerHTML = `
      <div class="lives-icons">
        <img class="life-icon" alt="" />
        <img class="life-icon" alt="" />
        <img class="life-icon" alt="" />
      </div>
      <span class="lives-value"></span>
    `;

    expect(() => game.displayLives()).not.toThrow();
    expect(document.querySelectorAll('.life-losing')).toHaveLength(3);
  });

  it('removes all excess life icons when multiple lives are lost at once', () => {
    const game = new Game(canvas);
    game.player = new Player(canvas);

    document.body.innerHTML = `
      <div class="lives-icons">
        <img class="life-icon" alt="" />
        <img class="life-icon" alt="" />
        <img class="life-icon" alt="" />
      </div>
      <span class="lives-value"></span>
    `;

    game.player.lives = 1;
    game.displayLives();

    expect(document.querySelectorAll('.life-losing')).toHaveLength(2);
  });
});
