import { activeMockGame, clearMockGames } from '../test-app-mocks';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import '../main';
import { makeBreakdown } from '../lib/score';
import { stubAnimationFrame } from '../test-helpers';
import { SURFACE_HANDOFF_BREAKDOWN } from '../test-game-factories';
import { bootSplashGame, SettledImage } from '../test-dom';

describe('transition screen routing', () => {
  beforeAll(() => {
    stubAnimationFrame();
  });

  beforeEach(() => {
    vi.stubGlobal('Image', SettledImage);
    clearMockGames();
    localStorage.setItem('surface-modal-dismissed', '1');
    localStorage.setItem('audio-muted', '1');
    bootSplashGame();
  });

  afterEach(() => {
    localStorage.removeItem('audio-muted');
    vi.unstubAllGlobals();
    vi.useRealTimers();
    stubAnimationFrame();
  });

  it('onComplete renders the arrival interstitial, then routes into the tunnel', () => {
    vi.useFakeTimers();
    activeMockGame().onComplete!(SURFACE_HANDOFF_BREAKDOWN);

    expect(document.querySelector('.to-be-continued-screen')).not.toBeNull();
    expect(document.querySelector('.transition-line')?.textContent).toBe('> somewhere underground...');

    vi.advanceTimersByTime(3600);
    expect(document.querySelector('.tunnel-game-canvas')).not.toBeNull();
  });

  it('shows the tunnel controls modal once, even for returning surface players', () => {
    vi.useFakeTimers();
    localStorage.removeItem('tunnel-modal-dismissed');
    activeMockGame().onComplete!(makeBreakdown({ surfaceTime: 42 }));
    vi.advanceTimersByTime(3600);
    expect(document.querySelector('.info-modal-backdrop')).not.toBeNull();
    expect(document.querySelector('.info-modal-title')?.textContent).toBe('How to play');
    document.querySelector<HTMLElement>('.info-modal-backdrop')?.remove();
  });

  it('plays no falling SFX through the interstitial when muted', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    activeMockGame().onComplete!(makeBreakdown({ surfaceTime: 5 }));
    expect(document.querySelector('.to-be-continued-screen')).not.toBeNull();
    expect(play).not.toHaveBeenCalled();
    play.mockRestore();
  });

  it('plays the falling SFX exactly once when unmuted', () => {
    localStorage.setItem('audio-muted', '0');
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    activeMockGame().onComplete!(makeBreakdown({ surfaceTime: 5 }));
    expect(play).toHaveBeenCalledTimes(1);
    play.mockRestore();
  });
});
