import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from './Game';
import { Player } from './Player';
import { Bomb } from './Bomb';
import { SPRITES } from './assets';

describe('Game', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 468;
    canvas.height = 468;
  });

  it('instantiates without throwing', () => {
    const game = new Game(canvas);
    expect(game).toBeDefined();
  });

  it('starts with no player', () => {
    const game = new Game(canvas);
    expect(game.player).toBeNull();
  });

  it('starts with an empty bombs array', () => {
    const game = new Game(canvas);
    expect(game.bombs).toHaveLength(0);
  });

  it('starts with isGameOver false', () => {
    const game = new Game(canvas);
    expect(game.isGameOver).toBe(false);
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

    expect(game.player.lives).toBe(3);
    expect(game.bombs).toHaveLength(2);

    for (let frame = 0; frame < 6; frame++) {
      game.update();
    }

    expect(game.player.lives).toBe(1);
    expect(game.bombs).toHaveLength(0);
  });
});
