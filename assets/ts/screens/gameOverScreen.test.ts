import { activeMockGame, clearMockGames } from '../test-app-mocks';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import '../main';
import { submitScore } from '../lib/leaderboard';
import { stubAnimationFrame } from '../test-helpers';
import { SURFACE_HANDOFF_BREAKDOWN } from '../test-game-factories';
import { bootSplashGame } from '../test-dom';

describe('game over screen tally', () => {
  beforeAll(() => {
    stubAnimationFrame();
  });

  beforeEach(() => {
    clearMockGames();
    localStorage.setItem('surface-modal-dismissed', '1');
    localStorage.setItem('audio-muted', '1');
    bootSplashGame();
  });

  afterEach(() => {
    localStorage.removeItem('audio-muted');
    vi.useRealTimers();
  });

  it('submits only the breakdown total and rolls the count up to it', () => {
    vi.useFakeTimers();
    vi.mocked(submitScore).mockClear();
    activeMockGame().onGameOver!(SURFACE_HANDOFF_BREAKDOWN);

    expect(document.querySelectorAll('.go-count-line')).toHaveLength(2);
    vi.advanceTimersByTime(2000);
    expect(document.querySelector('.go-score-value')?.textContent).toBe('57');
    expect(submitScore).toHaveBeenCalledWith(expect.any(String), 57);
  });
});
