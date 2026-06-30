import { activeMockGame, clearMockGames } from '../test-app-mocks';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import '../main';
import { makeBreakdown } from '../lib/score';
import { stubAnimationFrame } from '../test-helpers';
import { bootSplashGame } from '../test-dom';

describe('surface screen keyboard wiring', () => {
  beforeAll(() => {
    stubAnimationFrame();
  });

  beforeEach(() => {
    clearMockGames();
    localStorage.setItem('surface-modal-dismissed', '1');
    bootSplashGame();
  });

  function pressArrowRight(): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  }

  it('steers the active game with arrow keys', () => {
    pressArrowRight();
    expect(activeMockGame().player.setDirection).toHaveBeenCalledWith(1);
  });

  it.each(['onGameOver', 'onComplete'] as const)(
    'detaches the keydown listener when the run ends via %s',
    (end) => {
      const game = activeMockGame();
      game[end]!(makeBreakdown());
      game.player.setDirection.mockClear();
      pressArrowRight();
      expect(game.player.setDirection).not.toHaveBeenCalled();
    },
  );

  it('does not steer dead games from previous sessions', () => {
    const firstGame = activeMockGame();
    firstGame.onGameOver!(makeBreakdown());
    window.dispatchEvent(new Event('load'));
    (document.querySelector('.splash-start') as HTMLButtonElement).click();
    firstGame.player.setDirection.mockClear();
    pressArrowRight();
    expect(firstGame.player.setDirection).not.toHaveBeenCalled();
    expect(activeMockGame().player.setDirection).toHaveBeenCalledWith(1);
  });

  it('moves focus onto game over when the run ends', () => {
    expect((document.activeElement as HTMLElement).classList.contains('game-canvas')).toBe(true);
    activeMockGame().onGameOver!(makeBreakdown({ surfaceTime: 7 }));
    expect((document.activeElement as HTMLElement).classList.contains('go-title')).toBe(true);
  });
});
