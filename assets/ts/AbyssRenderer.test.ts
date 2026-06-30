import { describe, it, expect, vi, beforeAll } from 'vitest';
import { AbyssGame } from './AbyssGame';
import { AbyssRenderer } from './AbyssRenderer';
import { Stalactite } from './Stalactite';
import { makeBreakdown } from './lib/score';
import { makeCanvas, TEST_CANVAS_SIZE } from './test-helpers';

function makeAbyssGame(canvas: HTMLCanvasElement) {
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
    const canvas = makeCanvas();
    const game = makeAbyssGame(canvas);
    const stalactite = new Stalactite('large', game.playerWorldX);
    stalactite.hitsRemaining = 0;
    stalactite.destroyed = true;
    stalactite.fallY = 24;
    game.stalactites = [stalactite];
    const renderer = new AbyssRenderer(canvas);
    expect(() => renderer.render(game)).not.toThrow();
  });

  it.each<[string, (game: AbyssGame) => void]>([
    ['a cracked (mid-break) stalactite', (game) => {
      const stalactite = new Stalactite('large', game.playerWorldX);
      stalactite.hitsRemaining = 1; // hitsTaken = 2 → crack index 1 (the last crack)
      stalactite.shakeStepsLeft = 6;
      stalactite.boomStepsLeft = 6;
      game.stalactites = [stalactite];
    }],
    ['a stalactite culled far off-screen', (game) => {
      game.stalactites = [new Stalactite('small', game.cameraX + TEST_CANVAS_SIZE * 10)];
    }],
    ['both doors mid-open through the shared path', (game) => {
      game.entranceOpenFrac = 0.5;
      game.exitOpenFrac = 0.5;
    }],
  ])('renders %s without throwing', (_label, setup) => {
    const canvas = makeCanvas();
    const game = makeAbyssGame(canvas);
    setup(game);
    const renderer = new AbyssRenderer(canvas);
    expect(() => renderer.render(game)).not.toThrow();
  });
});
