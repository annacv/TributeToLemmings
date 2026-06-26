import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameLoop, STEP_MS, MAX_CATCHUP_STEPS } from './GameLoop';

/* Captures rAF callbacks so tests drive the loop with chosen timestamps */
function makeHarness(stepImpl: () => boolean = () => true) {
  const callbacks: FrameRequestCallback[] = [];
  const raf = vi.fn((cb: FrameRequestCallback) => {
    callbacks.push(cb);
    return callbacks.length;
  });
  const caf = vi.fn();
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', caf);

  const step = vi.fn(stepImpl);
  const render = vi.fn();
  const loop = new GameLoop({ step, render });

  return {
    loop,
    step,
    render,
    raf,
    caf,
    pump(timestamp: number): void {
      const cb = callbacks.shift();
      if (!cb) throw new Error('no rAF callback pending');
      cb(timestamp);
    },
    get pending(): number {
      return callbacks.length;
    },
  };
}

describe('GameLoop', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('start() runs one synchronous step and render, then schedules a frame', () => {
    const h = makeHarness();
    h.loop.start();
    expect(h.step).toHaveBeenCalledTimes(1);
    expect(h.render).toHaveBeenCalledTimes(1);
    expect(h.pending).toBe(1);
  });

  it('first callback ignores the page-load time origin (zero catch-up steps)', () => {
    const h = makeHarness();
    h.loop.start();
    h.pump(35000); // player idled 35 s on the previous screen
    expect(h.step).toHaveBeenCalledTimes(1); // only the synchronous start step
    expect(h.render).toHaveBeenCalledTimes(2); // start + this frame
    expect(h.pending).toBe(1); // loop continues
  });

  it('steps once per 60 Hz frame after the clock is anchored', () => {
    const h = makeHarness();
    h.loop.start();
    h.pump(1000);
    for (let i = 1; i <= 3; i++) h.pump(1000 + i * STEP_MS);
    expect(h.step).toHaveBeenCalledTimes(1 + 3);
  });

  it('renders without stepping when less than one step has accumulated', () => {
    const h = makeHarness();
    h.loop.start();
    h.pump(1000);
    h.pump(1000 + 8); // half a step at 120 Hz cadence
    expect(h.step).toHaveBeenCalledTimes(1);
    expect(h.render).toHaveBeenCalledTimes(3);
  });

  it('clamps a huge timestamp jump to MAX_CATCHUP_STEPS and discards the rest', () => {
    const h = makeHarness();
    h.loop.start();
    h.pump(1000);
    h.pump(61000); // 60 s stall
    expect(h.step).toHaveBeenCalledTimes(1 + MAX_CATCHUP_STEPS);
    // the discarded time must not leak into the next frame
    h.pump(61000 + 8);
    expect(h.step).toHaveBeenCalledTimes(1 + MAX_CATCHUP_STEPS);
  });

  it('stops stepping mid-catch-up when step() returns false, still rendering once', () => {
    let calls = 0;
    const h = makeHarness(() => ++calls < 3); // 3rd step halts
    h.loop.start();
    h.pump(1000);
    h.pump(1000 + MAX_CATCHUP_STEPS * STEP_MS); // 5 steps pending
    expect(h.step).toHaveBeenCalledTimes(3); // sync + 2 in this frame, not 5
    expect(h.render).toHaveBeenCalledTimes(3); // start + anchor + halting frame
    expect(h.pending).toBe(0); // no further frame scheduled
  });

  it('start() twice does not create a second loop', () => {
    const h = makeHarness();
    h.loop.start();
    h.loop.start();
    expect(h.step).toHaveBeenCalledTimes(1);
    expect(h.pending).toBe(1);
  });

  it('stop() cancels the scheduled frame', () => {
    const h = makeHarness();
    h.loop.start();
    h.loop.stop();
    expect(h.caf).toHaveBeenCalledTimes(1);
  });

  it('stop() from inside a step prevents rescheduling', () => {
    let calls = 0;
    const h = makeHarness(() => {
      calls++;
      if (calls === 2) h.loop.stop();
      return true;
    });
    h.loop.start();
    h.pump(1000);
    h.pump(1000 + STEP_MS);
    expect(h.render).toHaveBeenCalledTimes(3);
    expect(h.pending).toBe(0);
  });
});
