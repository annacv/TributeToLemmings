import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Player } from './Player';

const BLINK_TOTAL_FRAMES = 30;

function makeCtx() {
  const fills: string[] = [];
  const ctx = {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fill: vi.fn().mockImplementation(() => { fills.push(ctx.fillStyle as string); }),
    _fills: fills,
  };
  return ctx;
}

describe('Player', () => {
  let canvas: HTMLCanvasElement;
  let mockCtx: ReturnType<typeof makeCtx>;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    mockCtx = makeCtx();
    canvas.getContext = vi.fn().mockReturnValue(mockCtx) as typeof canvas.getContext;
    (global as unknown as Record<string, unknown>).Path2D = class {
      moveTo() {} lineTo() {} closePath() {} rect() {}
    };
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
    player.lives = 1; // post-damage
    player.triggerBlink(3); // snapshot from before damage
    expect(player.blinkColor).toBe('#FFFFFF');
  });

  it('drawImage first blink frame is visible', () => {
    const player = new Player(canvas);
    player.triggerBlink(); // blinkFramesLeft = 30
    player.drawImage(0);   // 30→29 (odd) → draws
    expect(mockCtx.fill).toHaveBeenCalled();
  });

  it('drawImage second blink frame is hidden', () => {
    const player = new Player(canvas);
    player.triggerBlink();
    player.drawImage(0);             // 30→29 visible
    mockCtx.fill.mockClear();
    player.drawImage(0);             // 29→28 (even) → skipped
    expect(mockCtx.fill).not.toHaveBeenCalled();
  });

  it('drawImage uses blinkColor (pre-damage) on visible blink frames', () => {
    const player = new Player(canvas);
    player.triggerBlink();   // blinkColor = '#FFFFFF' (3 lives)
    player.lives = 2;        // post-damage
    mockCtx._fills.length = 0;
    player.drawImage(0);     // first visible blink frame
    expect(mockCtx._fills[0]).toBe('#FFFFFF');
  });

  it('drawImage uses post-damage body color after blink ends', () => {
    const player = new Player(canvas);
    player.lives = 2;        // blinkFramesLeft is 0
    mockCtx._fills.length = 0;
    player.drawImage(0);
    expect(mockCtx._fills[0]).toBe('#FEBD00');
  });
});
