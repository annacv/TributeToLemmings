import { activeMockGame, clearMockGames } from '../test-app-mocks';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import '../main';
import { submitScore, fetchTopScores, getPlayerRank } from '../lib/leaderboard';
import { makeBreakdown } from '../lib/score';
import { stubAnimationFrame } from '../test-helpers';
import { mountSiteMain } from '../test-dom';
import type { ScoreRecord } from '../lib/firebase';

describe('ranking screen', () => {
  beforeAll(() => {
    stubAnimationFrame();
  });

  beforeEach(() => {
    clearMockGames();
    localStorage.setItem('surface-modal-dismissed', '1');
    localStorage.setItem('audio-muted', '1');
    mountSiteMain();
  });

  afterEach(() => {
    localStorage.removeItem('audio-muted');
    vi.mocked(fetchTopScores).mockResolvedValue([]);
    vi.useRealTimers();
  });

  it('shows the stored personal best, not this run, and ranks by it', async () => {
    vi.useFakeTimers();
    (document.querySelector('.splash-name-input') as HTMLInputElement).value = 'Anna';
    (document.querySelector('.splash-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true }));

    vi.mocked(submitScore).mockResolvedValue({ docId: 'me', bestScore: 50 });
    vi.mocked(fetchTopScores).mockResolvedValue([
      { id: 'other', name: 'Top', score: 99 } as ScoreRecord,
    ]);
    vi.mocked(getPlayerRank).mockResolvedValue(12);

    activeMockGame().onGameOver!(makeBreakdown({ surfaceTime: 30 }));
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(10);

    expect(getPlayerRank).toHaveBeenCalledWith(50);
    const score = document.querySelector('.ranking-row--current .ranking-score');
    expect(score?.textContent).toBe('50');
  });

  it('shows the error/retry UI when Firestore never responds', async () => {
    vi.useFakeTimers();
    (document.querySelector('.splash-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true }));
    vi.mocked(fetchTopScores).mockImplementation(() => new Promise(() => {}));
    activeMockGame().onGameOver!(makeBreakdown({ surfaceTime: 10 }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelector('.ranking-loading')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(2600);
    expect(document.querySelector('.ranking-error')).not.toBeNull();
    expect(document.querySelector('.ranking-retry')).not.toBeNull();
  });
});
