import '../test-app-mocks';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import '../main';
import {
  THE_END_WALK_MS,
  THE_END_PROMPT_HOLD_MS,
  THE_END_BOARD_MS,
  THE_END_END_HOLD_MS,
} from '../worlds/theEnd/TheEndScene';
import { stubAnimationFrame, stubMatchMedia } from '../test-helpers';
import { bootDebugScreen, PendingImage, SettledImage, stubAudioTracking } from '../test-dom';

describe('the end screen', () => {
  let audioSrcs: string[] = [];

  beforeAll(() => {
    stubAnimationFrame();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', SettledImage);
    ({ sources: audioSrcs } = stubAudioTracking());
    localStorage.setItem('audio-muted', '0');
    bootDebugScreen('theend');
  });

  afterEach(() => {
    history.replaceState(null, '', '/');
    localStorage.removeItem('audio-muted');
    vi.unstubAllGlobals();
    vi.useRealTimers();
    stubAnimationFrame();
  });

  it('mounts the finale with its own loop, not the ranking music', () => {
    expect(document.querySelector('.the-end-screen')).not.toBeNull();
    expect(audioSrcs.some((s) => /tim_2/i.test(s))).toBe(true);
    expect(audioSrcs.some((s) => /reed-flutes/i.test(s))).toBe(false);
    expect(document.querySelector('.ranking-screen')).toBeNull();
  });

  it('plays the balloon SFX after boarding, at ascent start — never before', () => {
    const balloonPlayed = (): boolean => audioSrcs.some((s) => /balloon/i.test(s));
    vi.advanceTimersByTime(THE_END_WALK_MS + THE_END_PROMPT_HOLD_MS);
    expect(balloonPlayed()).toBe(false);
    vi.advanceTimersByTime(THE_END_BOARD_MS);
    expect(balloonPlayed()).toBe(true);
  });

  it('a press lifts off immediately, without waiting out the prompt hold', () => {
    const balloonPlayed = (): boolean => audioSrcs.some((s) => /balloon/i.test(s));
    vi.advanceTimersByTime(THE_END_WALK_MS);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    vi.advanceTimersByTime(THE_END_BOARD_MS);
    expect(balloonPlayed()).toBe(true);
  });

  it('auto-advances to the ranking even with no input (no soft-lock)', () => {
    vi.advanceTimersByTime(60000);
    expect(document.querySelector('.ranking-screen')).not.toBeNull();
  });

  it('the Skip button routes straight to the ranking', () => {
    (document.querySelector('.the-end-skip') as HTMLButtonElement).click();
    expect(document.querySelector('.ranking-screen')).not.toBeNull();
  });

  it('wires Skip and the auto-route timer even while the scene assets are still loading', () => {
    vi.stubGlobal('Image', PendingImage);
    bootDebugScreen('theend');

    expect(document.querySelector('.the-end-screen')).not.toBeNull();
    (document.querySelector('.the-end-skip') as HTMLButtonElement).click();
    expect(document.querySelector('.ranking-screen')).not.toBeNull();
  });

  it('reduced motion jumps to the end state and routes to the ranking without the cinematic', () => {
    const restoreMatchMedia = stubMatchMedia((q) => /reduce/.test(q));
    bootDebugScreen('theend');

    expect(document.querySelector('.the-end-credits--static')).not.toBeNull();
    vi.advanceTimersByTime(THE_END_END_HOLD_MS);
    expect(document.querySelector('.ranking-screen')).not.toBeNull();
    restoreMatchMedia();
  });

  it('reduced motion redraws the finale once scene assets finish decoding', () => {
    const restoreMatchMedia = stubMatchMedia((q) => /reduce/.test(q));

    class DeferredImage {
      complete = false;
      naturalWidth = 0;
      naturalHeight = 0;
      src = '';
      addEventListener(event: string, cb: () => void): void {
        if (event === 'load') {
          setTimeout(() => {
            this.complete = true;
            this.naturalWidth = 800;
            this.naturalHeight = 800;
            cb();
          }, 0);
        }
      }
    }
    vi.stubGlobal('Image', DeferredImage);
    const drawImage = vi.fn();
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this, type, options) {
      const ctx = origGetContext.call(this, type, options) as CanvasRenderingContext2D | null;
      if (ctx && type === '2d') ctx.drawImage = drawImage;
      return ctx;
    });
    bootDebugScreen('theend');

    expect(drawImage).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(drawImage).toHaveBeenCalled();

    restoreMatchMedia();
  });
});
