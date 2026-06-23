import { describe, it, expect, vi, beforeAll } from 'vitest';
import { AbyssGame } from './AbyssGame';
import { AbyssRenderer } from './AbyssRenderer';
import { Stalactite } from './Stalactite';
import { makeBreakdown } from './lib/score';
import { makeCanvas } from './test-helpers';

const W = 400;

function makeGame(canvas: HTMLCanvasElement) {
  const game = new AbyssGame(canvas, makeBreakdown({ surfaceTime: 42, tunnelTime: 30, levelsBonus: 30 }));
  game.startGame();
  return game;
}

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

describe('AbyssRenderer', () => {
  it('clears the canvas and draws the bottom-left HUD hint each frame', () => {
    const canvas = makeCanvas(W, W);
    const game = makeGame(canvas);
    game.breaks = { small: 2, medium: 1, large: 0 };
    const renderer = new AbyssRenderer(canvas);
    const ctx = canvas.getContext('2d') as unknown as ReturnType<typeof vi.fn> & {
      clearRect: ReturnType<typeof vi.fn>; fillText: ReturnType<typeof vi.fn>;
    };

    renderer.render(game);

    expect(ctx.clearRect).toHaveBeenCalled();
    const hintCalls = ctx.fillText.mock.calls.map((c) => c[0]);
    expect(hintCalls).toContain('S2 M1 L0');
  });

  it('renders a destroyed, falling stalactite without indexing a missing crack', () => {
    const canvas = makeCanvas(W, W);
    const game = makeGame(canvas);
    const st = new Stalactite('large', game.playerWorldX);
    st.hitsRemaining = 0;
    st.destroyed = true;
    st.fallY = 24;
    game.stalactites = [st];
    const renderer = new AbyssRenderer(canvas);
    expect(() => renderer.render(game)).not.toThrow();
  });

  it('renders a cracked (mid-break) stalactite without throwing', () => {
    const canvas = makeCanvas(W, W);
    const game = makeGame(canvas);
    const st = new Stalactite('large', game.playerWorldX);
    st.hitsRemaining = 1; // hitsTaken = 2 → crack index 1 (the last crack)
    st.shakeStepsLeft = 6;
    st.boomStepsLeft = 6;
    game.stalactites = [st];
    const renderer = new AbyssRenderer(canvas);
    expect(() => renderer.render(game)).not.toThrow();
  });

  it('skips stalactites culled far off-screen', () => {
    const canvas = makeCanvas(W, W);
    const game = makeGame(canvas);
    game.stalactites = [new Stalactite('small', game.cameraX + W * 10)];
    const renderer = new AbyssRenderer(canvas);
    expect(() => renderer.render(game)).not.toThrow();
  });

  it('draws both doors through the shared path without throwing', () => {
    const canvas = makeCanvas(W, W);
    const game = makeGame(canvas);
    game.entranceOpenFrac = 0.5;
    game.exitOpenFrac = 0.5;
    const renderer = new AbyssRenderer(canvas);
    expect(() => renderer.render(game)).not.toThrow();
  });
});
