import { vi } from 'vitest';
import type { ScoreBreakdown } from './lib/score';

export interface MockSurfaceGame {
  player: { setDirection: ReturnType<typeof vi.fn> };
  gameSong: { muted: boolean };
  onGameOver: ((breakdown: ScoreBreakdown) => void) | null;
  onComplete: ((breakdown: ScoreBreakdown) => void) | null;
  startSong: ReturnType<typeof vi.fn>;
  startGame: ReturnType<typeof vi.fn>;
}

const { gameInstances } = vi.hoisted(() => ({
  gameInstances: [] as MockSurfaceGame[],
}));

export function clearMockGames(): void {
  gameInstances.length = 0;
}

export function activeMockGame(): MockSurfaceGame {
  return gameInstances[gameInstances.length - 1];
}

export function lastMockGame(): MockSurfaceGame | undefined {
  return gameInstances[gameInstances.length - 1];
}

vi.mock('./lib/leaderboard', () => ({
  preloadLeaderboard: vi.fn(),
  submitScore: vi.fn().mockResolvedValue({ docId: 'doc-id', bestScore: 0 }),
  fetchTopScores: vi.fn().mockResolvedValue([]),
  getPlayerRank: vi.fn().mockResolvedValue(1),
}));

vi.mock('./SurfaceGame', () => ({
  SurfaceGame: class {
    player = { setDirection: vi.fn() };
    gameSong = { muted: false };
    onGameOver: ((breakdown: ScoreBreakdown) => void) | null = null;
    onComplete: ((breakdown: ScoreBreakdown) => void) | null = null;
    startSong = vi.fn();
    startGame = vi.fn();
    private controller = new AbortController();
    get runSignal(): AbortSignal { return this.controller.signal; }
    constructor() { gameInstances.push(this); }
    gameOverCallback(cb: (breakdown: ScoreBreakdown) => void): void {
      this.onGameOver = (breakdown) => { this.controller.abort(); cb(breakdown); };
    }
    completionCallback(cb: (breakdown: ScoreBreakdown) => void): void {
      this.onComplete = (breakdown) => { this.controller.abort(); cb(breakdown); };
    }
  },
}));
