import '../test-app-mocks';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import '../main';
import { TunnelGame } from '../worlds/tunnel/TunnelGame';
import { stubAnimationFrame } from '../test-helpers';
import { bootDebugScreen, SettledImage, stubAudioTracking } from '../test-dom';

describe('tunnel screen completion routing', () => {
  let audioSrcs: string[] = [];
  let tunnels: TunnelGame[] = [];

  beforeAll(() => {
    stubAnimationFrame();
  });

  beforeEach(() => {
    vi.stubGlobal('Image', SettledImage);
    ({ sources: audioSrcs } = stubAudioTracking());
    tunnels = [];
    const origStart = TunnelGame.prototype.startGame;
    vi.spyOn(TunnelGame.prototype, 'startGame').mockImplementation(function (this: TunnelGame) {
      tunnels.push(this);
      origStart.call(this);
    });
    localStorage.setItem('audio-muted', '0');
    localStorage.setItem('surface-modal-dismissed', '1');
    localStorage.setItem('tunnel-modal-dismissed', '1');
    bootDebugScreen('tunnel');
  });

  afterEach(() => {
    history.replaceState(null, '', '/');
    localStorage.removeItem('audio-muted');
    localStorage.removeItem('surface-modal-dismissed');
    localStorage.removeItem('tunnel-modal-dismissed');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    stubAnimationFrame();
  });

  it('completion routes into the Abyss cold-open, not the win screen', () => {
    vi.useFakeTimers();
    const game = tunnels[0];
    game.cyclesCleared = 2;
    game.cycle = 2;
    game.state = 'armed';
    game.fuseStepsLeft = 1;
    game.step();
    for (let i = 0; i < 300 && !game.isOver; i++) game.step();
    expect(game.isOver).toBe(true);
    game['host']['frame']();
    vi.advanceTimersByTime(3600);

    expect(document.querySelector('canvas[aria-label^="The Abyss"]')).not.toBeNull();
    expect(document.querySelector('.go-title')).toBeNull();
    expect(audioSrcs.some((src) => /die\.wav/i.test(src))).toBe(false);
  });

  it('the cave loop loops, respects the mute gate, and pauses with a hidden tab', () => {
    localStorage.setItem('audio-muted', '1');
    bootDebugScreen('tunnel');
    const game = tunnels[tunnels.length - 1];
    expect(game.caveLoop?.loop).toBe(true);
    expect(game.caveLoop?.muted).toBe(true);

    const pause = vi.spyOn(game.caveLoop!, 'pause');
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pause).toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });
});
