import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from './Player';

describe('Player', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
  });

  it('instantiates without throwing', () => {
    const player = new Player(canvas);
    expect(player).toBeDefined();
  });

  it('starts with 3 lives', () => {
    const player = new Player(canvas);
    expect(player.lives).toBe(3);
  });

  it('setDirection updates direction', () => {
    const player = new Player(canvas);
    player.setDirection(1);
    expect(player.direction).toBe(1);
  });
});
