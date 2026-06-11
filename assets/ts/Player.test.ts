import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Player } from './Player';
import { makeCtx, makeCanvas } from './test-helpers';

const BLINK_TOTAL_FRAMES = 30;

describe('Player', () => {
  let canvas: HTMLCanvasElement;
  let mockCtx: ReturnType<typeof makeCtx>;

  beforeEach(() => {
    mockCtx = makeCtx();
    canvas = makeCanvas();
    canvas.getContext = vi.fn().mockReturnValue(mockCtx) as typeof canvas.getContext;
  });

  it('instantiates without throwing', () => {
    expect(() => new Player(canvas)).not.toThrow();
  });

  it('starts with 3 lives', () => {
    expect(new Player(canvas).lives).toBe(3);
  });

  it('starts stationary', () => {
    expect(new Player(canvas).direction).toBe(0);
  });

  it('setDirection updates direction', () => {
    const player = new Player(canvas);
    player.setDirection(1);
    expect(player.direction).toBe(1);
  });

  it('move() with direction 0 does not change position', () => {
    const player = new Player(canvas);
    const dx = player.dx;
    player.move();
    expect(player.dx).toBe(dx);
  });

  it('bounces off right wall', () => {
    const player = new Player(canvas);
    player.setDirection(1);
    // Boundary: canvas.width - dWidth - 1 = 349
    // Bounce when dx_after_move + speed >= 349, i.e. when next step would cross.
    // dx=347 → after move: 348 → 348+1=349 >= 349 → bounce
    player.dx = 347;
    player.move();
    expect(player.direction).toBe(-1);
  });

  it('bounces off left wall', () => {
    const player = new Player(canvas);
    player.setDirection(-1);
    // dx=2 → after move: 1 → 1-1=0 === 0 → bounce
    player.dx = 2;
    player.move();
    expect(player.direction).toBe(1);
  });

  it('does not walk off the left edge when ← is pressed right after a left-wall bounce', () => {
    const player = new Player(canvas);
    player.dx = 1;
    player.setDirection(1);
    player.setDirection(-1);
    for (let i = 0; i < 10; i++) {
      player.move();
      expect(player.dx).toBeGreaterThanOrEqual(0);
    }
    expect(player.direction).toBe(1);
  });

  it('does not walk off the right edge when → is pressed right after a right-wall bounce', () => {
    const player = new Player(canvas);
    player.dx = 348;
    player.setDirection(-1);
    player.setDirection(1);
    for (let i = 0; i < 10; i++) {
      player.move();
      expect(player.dx).toBeLessThanOrEqual(349);
    }
    expect(player.direction).toBe(-1);
  });

  it('triggerBlink sets blinkFramesLeft', () => {
    const player = new Player(canvas);
    player.triggerBlink();
    expect(player.blinkFramesLeft).toBe(BLINK_TOTAL_FRAMES);
  });

  it('triggerBlink captures pre-damage color at 3 lives', () => {
    const player = new Player(canvas);
    player.triggerBlink();
    expect(player.blinkColor).toBe('#FFFFFF');
  });

  it('triggerBlink captures pre-damage color at 2 lives', () => {
    const player = new Player(canvas);
    player.lives = 2;
    player.triggerBlink();
    expect(player.blinkColor).toBe('#FEBD00');
  });

  it('triggerBlink uses livesSnapshot when provided', () => {
    const player = new Player(canvas);
    player.lives = 1;
    player.triggerBlink(3);
    expect(player.blinkColor).toBe('#FFFFFF');
  });

  it('drawImage first blink frame is visible', () => {
    const player = new Player(canvas);
    player.triggerBlink();
    player.drawImage(0);
    expect(mockCtx.fill).toHaveBeenCalled();
  });

  it('drawImage second blink frame is hidden', () => {
    const player = new Player(canvas);
    player.triggerBlink();
    player.drawImage(0);
    mockCtx.fill.mockClear();
    player.drawImage(0);
    expect(mockCtx.fill).not.toHaveBeenCalled();
  });

  it('blink duration elapses per simulation step (tickBlink), not per draw', () => {
    const player = new Player(canvas);
    player.triggerBlink();
    player.drawImage(0);
    player.drawImage(0);
    expect(player.blinkFramesLeft).toBe(BLINK_TOTAL_FRAMES);
    player.tickBlink();
    expect(player.blinkFramesLeft).toBe(BLINK_TOTAL_FRAMES - 1);
  });

  it('re-triggering a blink makes the next rendered frame visible again', () => {
    const player = new Player(canvas);
    player.triggerBlink();
    player.drawImage(0); // visible, toggles to hidden
    player.triggerBlink();
    mockCtx.fill.mockClear();
    player.drawImage(0);
    expect(mockCtx.fill).toHaveBeenCalled();
  });

  it('blink flickers at 30 Hz cadence (2 steps per rendered frame) — never aliases away', () => {
    const player = new Player(canvas);
    player.triggerBlink();
    let visibleFrames = 0;
    let hiddenFrames = 0;
    while (player.blinkFramesLeft > 0) {
      player.tickBlink();
      player.tickBlink();
      mockCtx.fill.mockClear();
      player.drawImage(0);
      if (player.blinkFramesLeft > 0) {
        if (mockCtx.fill.mock.calls.length > 0) visibleFrames++;
        else hiddenFrames++;
      }
    }
    expect(visibleFrames).toBeGreaterThan(0);
    expect(hiddenFrames).toBeGreaterThan(0);
  });

  it('drawImage uses blinkColor (pre-damage) on visible blink frames', () => {
    const player = new Player(canvas);
    player.triggerBlink();
    player.lives = 2;
    mockCtx._fills.length = 0;
    player.drawImage(0);
    expect(mockCtx._fills[0]).toBe('#FFFFFF');
  });

  it('drawImage uses post-damage body color after blink ends', () => {
    const player = new Player(canvas);
    player.lives = 2;
    mockCtx._fills.length = 0;
    player.drawImage(0);
    expect(mockCtx._fills[0]).toBe('#FEBD00');
  });
});
