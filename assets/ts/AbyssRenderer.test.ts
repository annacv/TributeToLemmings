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

  it.each<[string, (game: AbyssGame) => void]>([
    ['a cracked (mid-break) stalactite', (game) => {
      const st = new Stalactite('large', game.playerWorldX);
      st.hitsRemaining = 1; // hitsTaken = 2 → crack index 1 (the last crack)
      st.shakeStepsLeft = 6;
      st.boomStepsLeft = 6;
      game.stalactites = [st];
    }],
    ['a stalactite culled far off-screen', (game) => {
      game.stalactites = [new Stalactite('small', game.cameraX + W * 10)];
    }],
    ['both doors mid-open through the shared path', (game) => {
      game.entranceOpenFrac = 0.5;
      game.exitOpenFrac = 0.5;
    }],
  ])('renders %s without throwing', (_label, setup) => {
    const canvas = makeCanvas(W, W);
    const game = makeGame(canvas);
    setup(game);
    const renderer = new AbyssRenderer(canvas);
    expect(() => renderer.render(game)).not.toThrow();
  });
});
