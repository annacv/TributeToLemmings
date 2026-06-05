import { describe, it, expect, beforeEach } from 'vitest';
import { Bomb } from './Bomb';
import { makeCanvas } from './test-helpers';

describe('Bomb', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
  });

  it('instantiates without throwing', () => {
    expect(() => new Bomb(canvas, 100)).not.toThrow();
  });

  it('starts at the given x position', () => {
    expect(new Bomb(canvas, 200).dx).toBe(200);
  });

  it('starts above the visible area', () => {
    expect(new Bomb(canvas, 0).dy).toBe(-45);
  });

  it('is not exploding on creation', () => {
    const bomb = new Bomb(canvas, 0);
    expect(bomb.isExploding).toBe(false);
    expect(bomb.explosionFramesLeft).toBe(0);
  });
});
