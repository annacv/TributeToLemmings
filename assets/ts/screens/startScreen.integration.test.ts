import { activeMockGame, clearMockGames } from '../test-app-mocks';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import '../main';
import { stubAnimationFrame } from '../test-helpers';
import { bootSplashGame } from '../test-dom';

describe('start screen', () => {
  beforeAll(() => {
    stubAnimationFrame();
  });

  beforeEach(() => {
    clearMockGames();
    localStorage.setItem('surface-modal-dismissed', '1');
    bootSplashGame();
  });

  it('starts the game on name-form submit (Enter in the input), even without a name', () => {
    window.dispatchEvent(new Event('load'));
    const form = document.querySelector('.splash-form') as HTMLFormElement;
    expect((document.querySelector('.splash-name-input') as HTMLInputElement).value).toBe('');

    form.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(document.querySelector('.game-canvas')).not.toBeNull();
    expect(activeMockGame()).toBeDefined();
  });
});
