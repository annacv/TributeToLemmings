import '../test-app-mocks';
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import '../main';
import { stubAnimationFrame } from '../test-helpers';
import { bootDebugScreen, SettledImage } from '../test-dom';

describe('tunnel screen input guards (via ?screen=tunnel debug seam)', () => {
  beforeAll(() => {
    stubAnimationFrame();
    vi.stubGlobal('Image', SettledImage);
    localStorage.setItem('audio-muted', '1');
    localStorage.setItem('tunnel-modal-dismissed', '1');
    bootDebugScreen('tunnel');
  });

  afterAll(() => {
    history.replaceState(null, '', '/');
    localStorage.removeItem('audio-muted');
    localStorage.removeItem('tunnel-modal-dismissed');
    vi.unstubAllGlobals();
    stubAnimationFrame();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function pressSpace(init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true, ...init });
    document.dispatchEvent(event);
    return event;
  }

  it('Space fires the game action and is preventDefault-ed', async () => {
    const { TunnelGame } = await import('../TunnelGame');
    const action = vi.spyOn(TunnelGame.prototype, 'action');
    const event = pressSpace();
    expect(action).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('key auto-repeat fires no game action', async () => {
    const { TunnelGame } = await import('../TunnelGame');
    const action = vi.spyOn(TunnelGame.prototype, 'action');
    pressSpace({ repeat: true });
    expect(action).not.toHaveBeenCalled();
  });

  it('Space with a focused control still acts on the game, not the control', async () => {
    const { TunnelGame } = await import('../TunnelGame');
    const action = vi.spyOn(TunnelGame.prototype, 'action');
    const muteBtn = document.querySelector('.mute-btn') as HTMLButtonElement;
    muteBtn.focus();
    const event = pressSpace();
    expect(action).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });
});
