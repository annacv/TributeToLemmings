import { activeMockGame, clearMockGames } from '../test-app-mocks';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import '../main';
import { stubAnimationFrame } from '../test-helpers';
import { mountSiteMain } from '../test-dom';

describe('info modal', () => {
  beforeAll(() => {
    stubAnimationFrame();
  });

  beforeEach(() => {
    clearMockGames();
    mountSiteMain();
  });

  it('focuses the how-to modal; Escape closes it and starts the game', () => {
    (document.querySelector('.splash-start') as HTMLButtonElement).click();

    const confirmBtn = document.querySelector('.info-modal-btn') as HTMLButtonElement;
    expect(document.activeElement).toBe(confirmBtn);
    expect(activeMockGame().startGame).not.toHaveBeenCalled();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.querySelector('.info-modal-backdrop')).toBeNull();
    expect(activeMockGame().startGame).toHaveBeenCalledTimes(1);
    expect((document.activeElement as HTMLElement).classList.contains('game-canvas')).toBe(true);
  });
});
