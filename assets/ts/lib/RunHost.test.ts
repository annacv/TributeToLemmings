import { describe, it, expect, vi, afterEach } from 'vitest';
import { RunHost, type RunHostHooks } from './RunHost';
import { STEP_MS } from './GameLoop';

/* Captures rAF callbacks so tests drive the host with chosen timestamps,
   mirroring the GameLoop harness it composes. */
function makeHarness(overrides: Partial<RunHostHooks> = {}) {
  const callbacks: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', vi.fn((frameCallback: FrameRequestCallback) => {
    callbacks.push(frameCallback);
    return callbacks.length;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  let over = false;
  const hooks = {
    step: vi.fn(() => !over),
    render: vi.fn(),
    isOver: vi.fn(() => over),
    onEnd: vi.fn(),
    ...overrides,
  };
  const host = new RunHost(hooks);

  return {
    host,
    hooks,
    setOver(value: boolean): void { over = value; },
    pump(timestamp: number): void {
      const frameCallback = callbacks.shift();
      if (!frameCallback) throw new Error('no rAF callback pending');
      frameCallback(timestamp);
    },
    get pending(): number { return callbacks.length; },
  };
}

describe('RunHost', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not run teardown while the run is not over', () => {
    const h = makeHarness();
    h.host.start();
    h.pump(STEP_MS);
    h.pump(STEP_MS * 2);
    expect(h.hooks.onEnd).not.toHaveBeenCalled();
  });

  it('runs teardown exactly once across extra post-halt frames', () => {
    const h = makeHarness();
    h.host.start();
    h.setOver(true);
    /* Trailing frames can still render after the halt; settle must fire onEnd once */
    h.host['frame']();
    h.host['frame']();
    h.host['frame']();
    expect(h.hooks.onEnd).toHaveBeenCalledTimes(1);
  });

  it('aborts the run signal in lockstep with teardown', () => {
    const h = makeHarness();
    expect(h.host.runSignal.aborted).toBe(false);
    h.host.start();
    expect(h.host.runSignal.aborted).toBe(false);
    h.setOver(true);
    h.pump(STEP_MS);
    expect(h.host.runSignal.aborted).toBe(true);
    expect(h.hooks.onEnd).toHaveBeenCalledTimes(1);
  });
});
