import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Game } from './Game';
import { Player } from './Player';
import { Bomb } from './Bomb';
import { SPRITES } from './assets';
import { makeCanvas } from './test-helpers';

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
    <span class="lives-value"></span>
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

  it('removes all excess life icons when multiple lives are lost at once', () => {
    const game = makeGameWithPlayer(canvas);
    game.player.lives = 1;
    setupHud();

    game.displayLives();

    expect(document.querySelectorAll('.life-losing')).toHaveLength(2);
  });
});
