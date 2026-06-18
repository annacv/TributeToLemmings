import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { generateGuestHandle } from './main';
import { submitScore, fetchTopScores, getPlayerRank } from './lib/leaderboard';
import { makeBreakdown, type ScoreBreakdown } from './lib/score';
import { TunnelGame } from './TunnelGame';
import type { ScoreRecord } from './lib/firebase';

interface MockGame {
  player: { setDirection: ReturnType<typeof vi.fn> };
  gameSong: { muted: boolean };
  onGameOver: ((breakdown: ScoreBreakdown) => void) | null;
  onTunnelWorld: ((breakdown: ScoreBreakdown) => void) | null;
  startGame: ReturnType<typeof vi.fn>;
}

const { gameInstances } = vi.hoisted(() => ({
  gameInstances: [] as MockGame[],
}));

vi.mock('./lib/leaderboard', () => ({
  preloadLeaderboard: vi.fn(),
  submitScore: vi.fn().mockResolvedValue({ docId: 'doc-id', bestScore: 0 }),
  fetchTopScores: vi.fn().mockResolvedValue([]),
  getPlayerRank: vi.fn().mockResolvedValue(1),
}));

vi.mock('./SurfaceGame', () => ({
  SurfaceGame: class {
    player = { setDirection: vi.fn() };
    gameSong = { muted: false };
    onGameOver: ((breakdown: ScoreBreakdown) => void) | null = null;
    onTunnelWorld: ((breakdown: ScoreBreakdown) => void) | null = null;
    startGame = vi.fn();
    private runController = new AbortController();
    get runSignal(): AbortSignal { return this.runController.signal; }
    constructor() { gameInstances.push(this); }
    /* The real SurfaceGame aborts runSignal before firing these — keep the mock honest */
    gameOverCallback(cb: (breakdown: ScoreBreakdown) => void): void {
      this.onGameOver = (breakdown) => { this.runController.abort(); cb(breakdown); };
    }
    tunnelWorldCallback(cb: (breakdown: ScoreBreakdown) => void): void {
      this.onTunnelWorld = (breakdown) => { this.runController.abort(); cb(breakdown); };
    }
  },
}));

describe('generateGuestHandle', () => {
  it('starts with "Lemming #"', () => {
    expect(generateGuestHandle()).toMatch(/^Lemming #/);
  });

  it('has exactly 5 characters after the prefix', () => {
    const handle = generateGuestHandle();
    const suffix = handle.replace('Lemming #', '');
    expect(suffix).toHaveLength(5);
  });

  it('suffix contains only uppercase letters and digits', () => {
    for (let i = 0; i < 50; i++) {
      const suffix = generateGuestHandle().replace('Lemming #', '');
      expect(suffix).toMatch(/^[A-Z0-9]{5}$/);
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
    localStorage.setItem('surface-modal-dismissed', '1');
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
    game.onGameOver!(makeBreakdown());
    game.player.setDirection.mockClear();
    pressArrowRight();
    expect(game.player.setDirection).not.toHaveBeenCalled();
  });

  it('detaches the keydown listener on the tunnel transition', () => {
    const game = activeGame();
    game.onTunnelWorld!(makeBreakdown());
    game.player.setDirection.mockClear();
    pressArrowRight();
    expect(game.player.setDirection).not.toHaveBeenCalled();
  });

  it('does not steer dead games from previous sessions', () => {
    const firstGame = activeGame();
    firstGame.onGameOver!(makeBreakdown());
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
    activeGame().onGameOver!(makeBreakdown({ surfaceTime: 7 }));
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
    localStorage.removeItem('surface-modal-dismissed');
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

describe('ranking row outside the top 10', () => {
  beforeAll(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  beforeEach(() => {
    gameInstances.length = 0;
    localStorage.setItem('surface-modal-dismissed', '1');
    localStorage.setItem('audio-muted', '1');
    document.body.innerHTML = '<main id="site-main"></main>';
    window.dispatchEvent(new Event('load'));
  });

  afterEach(() => {
    localStorage.removeItem('audio-muted');
    vi.useRealTimers();
  });

  it('shows the stored personal best, not this run, and ranks by it', async () => {
    vi.useFakeTimers();
    (document.querySelector('.splash-name-input') as HTMLInputElement).value = 'Anna';
    (document.querySelector('.splash-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true }));

    /* This run scored 30, but the leaderboard already holds Anna's best of 50 */
    vi.mocked(submitScore).mockResolvedValue({ docId: 'me', bestScore: 50 });
    vi.mocked(fetchTopScores).mockResolvedValue([
      { id: 'other', name: 'Top', score: 99 } as ScoreRecord,
    ]);
    vi.mocked(getPlayerRank).mockResolvedValue(12);

    gameInstances[gameInstances.length - 1].onGameOver!(makeBreakdown({ surfaceTime: 30 }));
    await vi.advanceTimersByTimeAsync(2000); // game-over beat → ranking screen
    await vi.advanceTimersByTimeAsync(10);   // flush the ranking load

    expect(getPlayerRank).toHaveBeenCalledWith(50);
    const score = document.querySelector('.ranking-row--current .ranking-score');
    expect(score?.textContent).toBe('50');
  });
});

describe('interstitial routing and score passthrough (seam-test gate)', () => {
  /* jsdom never loads images: createTransitionScreen waits for the underground
     SVG to settle before arming its game-over timer. A pre-settled Image stub lets
     the stub/fallback route run start-to-end under fake timers. */
  class SettledImage {
    complete = true;
    naturalWidth = 1;
    src = '';
    addEventListener(): void {}
  }

  beforeAll(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  beforeEach(() => {
    vi.stubGlobal('Image', SettledImage);
    gameInstances.length = 0;
    localStorage.setItem('surface-modal-dismissed', '1');
    localStorage.setItem('audio-muted', '1');
    document.body.innerHTML = '<main id="site-main"></main>';
    window.dispatchEvent(new Event('load'));
    (document.querySelector('.splash-start') as HTMLButtonElement).click();
  });

  afterEach(() => {
    localStorage.removeItem('audio-muted');
    vi.unstubAllGlobals();
    vi.useRealTimers();
    /* beforeAll rAF stubs are re-applied for the rest of this suite */
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  function activeGame(): MockGame {
    return gameInstances[gameInstances.length - 1];
  }

  it('onTunnelWorld renders the arrival interstitial, then routes into the tunnel', () => {
    vi.useFakeTimers();
    activeGame().onTunnelWorld!(makeBreakdown({ surfaceTime: 42, levelsBonus: 15 }));

    expect(document.querySelector('.to-be-continued-screen')).not.toBeNull();
    /* The mid-scroll cliffhanger is gone; the arrival stinger carries the beat */
    expect(document.querySelector('.transition-line')?.textContent).toBe('> somewhere underground...');

    vi.advanceTimersByTime(3600); // image settle is immediate; fall + scroll + ceiling + breath elapse
    expect(document.querySelector('.tunnel-game-canvas')).not.toBeNull();
  });

  it('shows the tunnel controls modal once, even for returning surface players', () => {
    vi.useFakeTimers();
    /* surface-modal-dismissed is already set in beforeEach — the surface key
       must not suppress the tunnel modal (separate storage key) */
    localStorage.removeItem('tunnel-modal-dismissed');
    activeGame().onTunnelWorld!(makeBreakdown({ surfaceTime: 42 }));
    vi.advanceTimersByTime(3600);
    expect(document.querySelector('.info-modal-backdrop')).not.toBeNull();
    expect(document.querySelector('.info-modal-title')?.textContent).toBe('How to play');
    document.querySelector<HTMLElement>('.info-modal-backdrop')?.remove();
  });

  it('submits only the breakdown total and rolls the count up to it', () => {
    vi.useFakeTimers();
    vi.mocked(submitScore).mockClear();
    activeGame().onGameOver!(makeBreakdown({ surfaceTime: 42, levelsBonus: 15 }));
    
    expect(document.querySelectorAll('.go-count-line')).toHaveLength(2);
    vi.advanceTimersByTime(2000);
    expect(document.querySelector('.go-score-value')?.textContent).toBe('57');
    expect(submitScore).toHaveBeenCalledWith(expect.any(String), 57);
  });

  it('a surface-only death keeps the single-score presentation unchanged', () => {
    vi.useFakeTimers();
    activeGame().onGameOver!(makeBreakdown({ surfaceTime: 30 }));
    expect(document.querySelector('.go-count')).toBeNull();
    expect(document.querySelector('.go-title')?.textContent).toBe('GAME OVER');
    expect(document.querySelector('.go-boom')?.textContent).toBe('BOOOM!!!');
    expect(document.querySelector('.go-score-value')?.textContent).toBe('30');
  });

  it('plays no falling SFX through the interstitial when muted', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    activeGame().onTunnelWorld!(makeBreakdown({ surfaceTime: 5 }));
    expect(document.querySelector('.to-be-continued-screen')).not.toBeNull();
    expect(play).not.toHaveBeenCalled();
    play.mockRestore();
  });

  it('plays the falling SFX exactly once when unmuted', () => {
    localStorage.setItem('audio-muted', '0');
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    activeGame().onTunnelWorld!(makeBreakdown({ surfaceTime: 5 }));
    expect(play).toHaveBeenCalledTimes(1);
    play.mockRestore();
  });
});

describe('tunnel screen input guards (via ?screen=tunnel debug seam)', () => {
  class SettledImage {
    complete = true;
    naturalWidth = 1;
    src = '';
    addEventListener(): void {}
  }

  /* One mount for the whole suite: the run-scoped keydown listener lives on
     document, so re-mounting per test would stack alive listeners and make
     prototype-spy call counts nondeterministic */
  beforeAll(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('Image', SettledImage);
    localStorage.setItem('audio-muted', '1');
    localStorage.setItem('tunnel-modal-dismissed', '1');
    document.body.innerHTML = '<main id="site-main"></main>';
    history.replaceState(null, '', '/?screen=tunnel');
    window.dispatchEvent(new Event('load'));
  });

  afterAll(() => {
    history.replaceState(null, '', '/');
    localStorage.removeItem('audio-muted');
    localStorage.removeItem('tunnel-modal-dismissed');
    vi.unstubAllGlobals();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function pressSpace(init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true, ...init });
    document.dispatchEvent(event);
    return event;
  }

  it('renders the tunnel screen with the touch action button', () => {
    expect(document.querySelector('.tunnel-game-canvas')).not.toBeNull();
    expect(document.querySelector('.touch-action')?.textContent).toBe('SPACE');
    expect(document.querySelector('.level-value')?.textContent).toBe('1');
  });

  it('Space fires the game action and is preventDefault-ed', async () => {
    const { TunnelGame } = await import('./TunnelGame');
    const action = vi.spyOn(TunnelGame.prototype, 'action');
    const event = pressSpace();
    expect(action).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('key auto-repeat fires no game action', async () => {
    const { TunnelGame } = await import('./TunnelGame');
    const action = vi.spyOn(TunnelGame.prototype, 'action');
    pressSpace({ repeat: true });
    expect(action).not.toHaveBeenCalled();
  });

  it('Space with a focused control still acts on the game, not the control', async () => {
    const { TunnelGame } = await import('./TunnelGame');
    const action = vi.spyOn(TunnelGame.prototype, 'action');
    const muteBtn = document.querySelector('.mute-btn') as HTMLButtonElement;
    muteBtn.focus();
    const event = pressSpace();
    expect(action).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true); // prevents the button's Space activation
  });
});

describe('win variant end screen (tunnel completion)', () => {
  class SettledImage {
    complete = true;
    naturalWidth = 1;
    src = '';
    addEventListener(): void {}
  }

  let audioSrcs: string[] = [];
  let tunnels: TunnelGame[] = [];

  beforeAll(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  beforeEach(() => {
    vi.stubGlobal('Image', SettledImage);
    /* Track every created audio element by source: the win path must never
       construct the death knell */
    audioSrcs = [];
    const RealAudio = window.Audio;
    vi.stubGlobal('Audio', function (src?: string) {
      audioSrcs.push(src ?? '');
      return new RealAudio(src);
    });
    tunnels = [];
    const origStart = TunnelGame.prototype.startGame;
    vi.spyOn(TunnelGame.prototype, 'startGame').mockImplementation(function (this: TunnelGame) {
      tunnels.push(this);
      origStart.call(this);
    });
    localStorage.setItem('audio-muted', '0');
    localStorage.setItem('surface-modal-dismissed', '1');
    localStorage.setItem('tunnel-modal-dismissed', '1');
    document.body.innerHTML = '<main id="site-main"></main>';
    history.replaceState(null, '', '/?screen=tunnel');
    window.dispatchEvent(new Event('load'));
  });

  afterEach(() => {
    history.replaceState(null, '', '/');
    localStorage.removeItem('audio-muted');
    localStorage.removeItem('surface-modal-dismissed');
    localStorage.removeItem('tunnel-modal-dismissed');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('completion shows the win title with the count; DIE.WAV never plays; ranking music starts once', () => {
    vi.useFakeTimers();
    const game = tunnels[0];
    /* Drive the run to the third breach and through the tease to the cut */
    game.cyclesCleared = 2;
    game.cycle = 2;
    game.state = 'armed';
    game.fuseStepsLeft = 1;
    game.step();
    for (let i = 0; i < 300 && !game.isOver; i++) game.step();
    expect(game.isOver).toBe(true);
    game['renderFrame'](); // settle fires the completion route → Abyss fall transition
    /* The Abyss collapse-shaft transition plays first; the win screen lands after it
       (TRANSITION_TOTAL_MS + TRANSITION_BREATH_MS) */
    vi.advanceTimersByTime(3600);

    expect(document.querySelector('.go-title')?.textContent).toBe('> You made it!For now...');
    expect(document.querySelectorAll('.go-count-line').length).toBeGreaterThan(0);
    expect(audioSrcs.some((src) => /die\.wav/i.test(src))).toBe(false);

    const rankingStarts = () => audioSrcs.filter((src) => /reed-flutes/i.test(src)).length;
    expect(rankingStarts()).toBe(0); // not before the count completes
    vi.advanceTimersByTime(2500);    // lines + roll done → music
    expect(rankingStarts()).toBe(1);
    expect(audioSrcs.some((src) => /die\.wav/i.test(src))).toBe(false);
    vi.advanceTimersByTime(2000);    // through the extended hold → ranking screen
    expect(rankingStarts()).toBe(1); // exactly once
  });

  it('the cave loop loops, respects the mute gate, and pauses with a hidden tab', () => {
    localStorage.setItem('audio-muted', '1');
    document.body.innerHTML = '<main id="site-main"></main>';
    history.replaceState(null, '', '/?screen=tunnel');
    window.dispatchEvent(new Event('load'));
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

describe('leaderboard fetch timeout', () => {
  beforeAll(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  beforeEach(() => {
    gameInstances.length = 0;
    localStorage.setItem('surface-modal-dismissed', '1');
    localStorage.setItem('audio-muted', '1');
    document.body.innerHTML = '<main id="site-main"></main>';
    window.dispatchEvent(new Event('load'));
    (document.querySelector('.splash-form') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { cancelable: true }));
  });

  afterEach(() => {
    localStorage.removeItem('audio-muted');
    vi.mocked(fetchTopScores).mockResolvedValue([]);
    vi.useRealTimers();
  });

  it('shows the error/retry UI when Firestore never responds', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchTopScores).mockImplementation(() => new Promise(() => {}));
    gameInstances[gameInstances.length - 1].onGameOver!(makeBreakdown({ surfaceTime: 10 }));
    await vi.advanceTimersByTimeAsync(2000); // hold → ranking screen
    expect(document.querySelector('.ranking-loading')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(2600); // bounded fetch times out
    expect(document.querySelector('.ranking-error')).not.toBeNull();
    expect(document.querySelector('.ranking-retry')).not.toBeNull();
  });
});
