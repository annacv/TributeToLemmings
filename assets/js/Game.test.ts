import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from './Game';

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
});
