import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { generateGuestHandle } from './main';

interface MockGame {
  player: { setDirection: ReturnType<typeof vi.fn> };
  gameSong: { muted: boolean };
  onGameOver: ((score: number) => void) | null;
  onTunnelWorld: ((score: number) => void) | null;
  startGame: ReturnType<typeof vi.fn>;
}

const { gameInstances } = vi.hoisted(() => ({
  gameInstances: [] as MockGame[],
}));

vi.mock('./lib/firebase', () => ({
  submitScore: vi.fn().mockResolvedValue('doc-id'),
  fetchTopScores: vi.fn().mockResolvedValue([]),
  getPlayerRank: vi.fn().mockResolvedValue(1),
}));

vi.mock('./Game', () => ({
  Game: class {
    player = { setDirection: vi.fn() };
    gameSong = { muted: false };
    onGameOver: ((score: number) => void) | null = null;
    onTunnelWorld: ((score: number) => void) | null = null;
    startGame = vi.fn();
    constructor() { gameInstances.push(this); }
    gameOverCallback(cb: (score: number) => void): void { this.onGameOver = cb; }
    tunnelWorldCallback(cb: (score: number) => void): void { this.onTunnelWorld = cb; }
  },
}));

describe('generateGuestHandle', () => {
  it('starts with "Lemming #"', () => {
    expect(generateGuestHandle()).toMatch(/^Lemming #/);
  });

  it('has exactly 3 characters after the prefix', () => {
    const handle = generateGuestHandle();
    const suffix = handle.replace('Lemming #', '');
    expect(suffix).toHaveLength(3);
  });

  it('suffix contains only uppercase letters and digits', () => {
    for (let i = 0; i < 50; i++) {
      const suffix = generateGuestHandle().replace('Lemming #', '');
      expect(suffix).toMatch(/^[A-Z0-9]{3}$/);
    }
  });

  it('produces different handles across calls (probabilistic)', () => {
    const handles = new Set(Array.from({ length: 20 }, generateGuestHandle));
    expect(handles.size).toBeGreaterThan(1);
  });
});

describe('game screen keyboard wiring', () => {
  beforeAll(() => {
    /* jsdom has no rAF; the mascot loop needs it (getContext is stubbed in test-setup) */
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  beforeEach(() => {
    gameInstances.length = 0;
    localStorage.setItem('info-modal-dismissed', '1');
    document.body.innerHTML = '<main id="site-main"></main>';
    window.dispatchEvent(new Event('load'));
    (document.querySelector('.splash-start') as HTMLButtonElement).click();
  });

  function activeGame(): MockGame {
    return gameInstances[gameInstances.length - 1];
  }

  function pressArrowRight(): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  }

  it('steers the active game with arrow keys', () => {
    pressArrowRight();
    expect(activeGame().player.setDirection).toHaveBeenCalledWith(1);
  });

  it('detaches the keydown listener once the game is over', () => {
    const game = activeGame();
    game.onGameOver!(0);
    game.player.setDirection.mockClear();
    pressArrowRight();
    expect(game.player.setDirection).not.toHaveBeenCalled();
  });

  it('detaches the keydown listener on the tunnel transition', () => {
    const game = activeGame();
    game.onTunnelWorld!(0);
    game.player.setDirection.mockClear();
    pressArrowRight();
    expect(game.player.setDirection).not.toHaveBeenCalled();
  });

  it('does not steer dead games from previous sessions', () => {
    const firstGame = activeGame();
    firstGame.onGameOver!(0);
    /* Back to splash and into a second game, as 'Play again' does */
    window.dispatchEvent(new Event('load'));
    (document.querySelector('.splash-start') as HTMLButtonElement).click();
    firstGame.player.setDirection.mockClear();
    pressArrowRight();
    expect(firstGame.player.setDirection).not.toHaveBeenCalled();
    expect(activeGame().player.setDirection).toHaveBeenCalledWith(1);
  });

  it('moves focus onto each new screen', () => {
    expect((document.activeElement as HTMLElement).classList.contains('game-canvas')).toBe(true);
    activeGame().onGameOver!(7);
    expect((document.activeElement as HTMLElement).classList.contains('go-title')).toBe(true);
  });

  it('starts the game on name-form submit (Enter in the input), even without a name', () => {
    window.dispatchEvent(new Event('load'));
    const form = document.querySelector('.splash-form') as HTMLFormElement;
    expect((document.querySelector('.splash-name-input') as HTMLInputElement).value).toBe('');

    form.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(document.querySelector('.game-canvas')).not.toBeNull();
  });

  it('focuses the how-to modal; Escape closes it and starts the game', () => {
    localStorage.removeItem('info-modal-dismissed');
    window.dispatchEvent(new Event('load'));
    (document.querySelector('.splash-start') as HTMLButtonElement).click();

    const confirmBtn = document.querySelector('.info-modal-btn') as HTMLButtonElement;
    expect(document.activeElement).toBe(confirmBtn);
    expect(activeGame().startGame).not.toHaveBeenCalled();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.querySelector('.info-modal-backdrop')).toBeNull();
    expect(activeGame().startGame).toHaveBeenCalledTimes(1);
    expect((document.activeElement as HTMLElement).classList.contains('game-canvas')).toBe(true);
  });
});
