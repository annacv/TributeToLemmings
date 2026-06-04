import { describe, it, expect, beforeEach } from 'vitest';
import { Bomb } from './Bomb';

describe('Bomb', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
  });

  it('instantiates without throwing', () => {
    const bomb = new Bomb(canvas, 100);
    expect(bomb).toBeDefined();
  });

  it('starts at the given x position', () => {
    const bomb = new Bomb(canvas, 200);
    expect(bomb.dx).toBe(200);
  });

  it('starts above the visible area', () => {
    const bomb = new Bomb(canvas, 0);
    expect(bomb.dy).toBe(-45);
  });

  it('is not exploding on creation', () => {
    const bomb = new Bomb(canvas, 0);
    expect(bomb.isExploding).toBe(false);
    expect(bomb.explosionFramesLeft).toBe(0);
  });
});
