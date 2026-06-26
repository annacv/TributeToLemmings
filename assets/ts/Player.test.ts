import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Player, BLINK_TOTAL_STEPS } from './Player';
import { makeCtx, makeCanvas } from './test-helpers';

describe('Player', () => {
  let canvas: HTMLCanvasElement;
  let mockCtx: ReturnType<typeof makeCtx>;

  beforeEach(() => {
    mockCtx = makeCtx();
    canvas = makeCanvas();
    canvas.getContext = vi.fn().mockReturnValue(mockCtx) as typeof canvas.getContext;
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

  it.each([
    { lives: 3, snapshot: undefined, color: '#FFFFFF' },
    { lives: 2, snapshot: undefined, color: '#FEBD00' },
    { lives: 1, snapshot: 3, color: '#FFFFFF' }, // snapshot overrides current lives
  ])('triggerBlink captures the pre-damage color (lives $lives, snapshot $snapshot → $color)', ({ lives, snapshot, color }) => {
    const player = new Player(canvas);
    player.lives = lives;
    player.triggerBlink(snapshot);
    expect(player.blinkColor).toBe(color);
  });

  it('blink duration elapses per simulation step (tickBlink), not per draw', () => {
    const player = new Player(canvas);
    player.triggerBlink();
    player.drawImage(0);
    player.drawImage(0);
    expect(player.blinkStepsLeft).toBe(BLINK_TOTAL_STEPS);
    player.tickBlink();
    expect(player.blinkStepsLeft).toBe(BLINK_TOTAL_STEPS - 1);
  });

  it('blink flickers at 30 Hz cadence (2 steps per rendered frame) — never aliases away', () => {
    const player = new Player(canvas);
    player.triggerBlink();
    let visibleFrames = 0;
    let hiddenFrames = 0;
    while (player.blinkStepsLeft > 0) {
      player.tickBlink();
      player.tickBlink();
      mockCtx.fill.mockClear();
      player.drawImage(0);
      if (player.blinkStepsLeft > 0) {
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
