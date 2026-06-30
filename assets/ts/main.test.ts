import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  generateGuestHandle,
  THE_END_WALK_MS,
  THE_END_PROMPT_HOLD_MS,
  THE_END_BOARD_MS,
  THE_END_END_HOLD_MS,
} from './main';
import { submitScore, fetchTopScores, getPlayerRank } from './lib/leaderboard';
import { makeBreakdown, LEVEL_POINTS, STALACTITE_POINTS, type ScoreBreakdown } from './lib/score';
import { TunnelGame, TOTAL_CYCLES } from './TunnelGame';
import { AbyssGame, ABYSS_TIME_BUDGET_S, ABYSS_LEVEL_CONFIG } from './AbyssGame';
import { makeCanvas, stubAnimationFrame, stubMatchMedia } from './test-helpers';
import { SURFACE_HANDOFF_BREAKDOWN } from './test-game-factories';
import {
  bootDebugScreen,
  bootSplashGame,
  mountSiteMain,
  PendingImage,
  SettledImage,
  stubAudioTracking,
} from './test-dom';
import { STEPS_PER_SECOND } from './lib/GameLoop';
import type { ScoreRecord } from './lib/firebase';

interface MockGame {
  player: { setDirection: ReturnType<typeof vi.fn> };
  gameSong: { muted: boolean };
  onGameOver: ((breakdown: ScoreBreakdown) => void) | null;
  onComplete: ((breakdown: ScoreBreakdown) => void) | null;
  startSong: ReturnType<typeof vi.fn>;
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
    onComplete: ((breakdown: ScoreBreakdown) => void) | null = null;
    startSong = vi.fn();
    startGame = vi.fn();
    private controller = new AbortController();
    get runSignal(): AbortSignal { return this.controller.signal; }
    constructor() { gameInstances.push(this); }
    /* The real SurfaceGame aborts runSignal before firing these — keep the mock honest */
    gameOverCallback(cb: (breakdown: ScoreBreakdown) => void): void {
      this.onGameOver = (breakdown) => { this.controller.abort(); cb(breakdown); };
    }
    completionCallback(cb: (breakdown: ScoreBreakdown) => void): void {
      this.onComplete = (breakdown) => { this.controller.abort(); cb(breakdown); };
    }
  },
}));

describe('generateGuestHandle', () => {
  it('formats as "Lemming #" + 5 uppercase letters/digits', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateGuestHandle()).toMatch(/^Lemming #[A-Z0-9]{5}$/);
    }
  });

  it('produces different handles across calls (probabilistic)', () => {
    const handles = new Set(Array.from({ length: 20 }, generateGuestHandle));
    expect(handles.size).toBeGreaterThan(1);
  });
});

describe('game screen keyboard wiring', () => {
  beforeAll(() => {
    stubAnimationFrame();
  });

  beforeEach(() => {
    gameInstances.length = 0;
    localStorage.setItem('surface-modal-dismissed', '1');
    bootSplashGame();
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

  it.each(['onGameOver', 'onComplete'] as const)(
    'detaches the keydown listener when the run ends via %s',
    (end) => {
      const game = activeGame();
      game[end]!(makeBreakdown());
      game.player.setDirection.mockClear();
      pressArrowRight();
      expect(game.player.setDirection).not.toHaveBeenCalled();
    },
  );

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
    stubAnimationFrame();
  });

  beforeEach(() => {
    gameInstances.length = 0;
    localStorage.setItem('surface-modal-dismissed', '1');
    localStorage.setItem('audio-muted', '1');
    mountSiteMain();
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
  beforeAll(() => {
    stubAnimationFrame();
  });

  beforeEach(() => {
    vi.stubGlobal('Image', SettledImage);
    gameInstances.length = 0;
    localStorage.setItem('surface-modal-dismissed', '1');
    localStorage.setItem('audio-muted', '1');
    bootSplashGame();
  });

  afterEach(() => {
    localStorage.removeItem('audio-muted');
    vi.unstubAllGlobals();
    vi.useRealTimers();
    stubAnimationFrame(); // restore noop rAF after unstubAllGlobals
  });

  function activeGame(): MockGame {
    return gameInstances[gameInstances.length - 1];
  }

  it('onComplete renders the arrival interstitial, then routes into the tunnel', () => {
    vi.useFakeTimers();
    activeGame().onComplete!(SURFACE_HANDOFF_BREAKDOWN);

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
    activeGame().onComplete!(makeBreakdown({ surfaceTime: 42 }));
    vi.advanceTimersByTime(3600);
    expect(document.querySelector('.info-modal-backdrop')).not.toBeNull();
    expect(document.querySelector('.info-modal-title')?.textContent).toBe('How to play');
    document.querySelector<HTMLElement>('.info-modal-backdrop')?.remove();
  });

  it('submits only the breakdown total and rolls the count up to it', () => {
    vi.useFakeTimers();
    vi.mocked(submitScore).mockClear();
    activeGame().onGameOver!(SURFACE_HANDOFF_BREAKDOWN);

    expect(document.querySelectorAll('.go-count-line')).toHaveLength(2);
    vi.advanceTimersByTime(2000);
    expect(document.querySelector('.go-score-value')?.textContent).toBe('57');
    expect(submitScore).toHaveBeenCalledWith(expect.any(String), 57);
  });

  it('plays no falling SFX through the interstitial when muted', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    activeGame().onComplete!(makeBreakdown({ surfaceTime: 5 }));
    expect(document.querySelector('.to-be-continued-screen')).not.toBeNull();
    expect(play).not.toHaveBeenCalled();
    play.mockRestore();
  });

  it('plays the falling SFX exactly once when unmuted', () => {
    localStorage.setItem('audio-muted', '0');
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    activeGame().onComplete!(makeBreakdown({ surfaceTime: 5 }));
    expect(play).toHaveBeenCalledTimes(1);
    play.mockRestore();
  });
});

describe('cumulative score passthrough (seam-test gate)', () => {
  beforeAll(() => {
    stubAnimationFrame();
  });

  it('the win breakdown sums surface + tunnel + abyss + stalactites + levels, dropping nothing', () => {
    const SURFACE_TIME = 42;
    const SURFACE_LEVELS = 3;
    const TUNNEL_BANKED = 23;

    /* Surface hands off exactly this shape (SurfaceGame.currentBreakdown). */
    const surfaceBreakdown = makeBreakdown({
      surfaceTime: SURFACE_TIME,
      levelsBonus: SURFACE_LEVELS * LEVEL_POINTS,
    });

    /* Tunnel carries the surface forward and adds banked seconds + cleared cycles. */
    const tunnel = new TunnelGame(makeCanvas(), surfaceBreakdown);
    tunnel.bankedSeconds = TUNNEL_BANKED;
    tunnel.cyclesCleared = TOTAL_CYCLES;
    const tunnelBreakdown = tunnel.currentBreakdown();
    expect(tunnelBreakdown.surfaceTime).toBe(SURFACE_TIME); // surface survived the hop
    expect(tunnelBreakdown.tunnelTime).toBe(TUNNEL_BANKED);
    expect(tunnelBreakdown.levelsBonus).toBe((SURFACE_LEVELS + TOTAL_CYCLES) * LEVEL_POINTS);

    /* Abyss carries surface + tunnel forward and adds abyss time + stalactites +
       abyss levels; drive it to the real completion (crossing the L3 time budget). */
    const abyss = new AbyssGame(makeCanvas(), tunnelBreakdown);
    abyss.startGame();
    if (abyss.player) abyss.player.lives = Number.MAX_SAFE_INTEGER;
    abyss.breaks = { small: 2, medium: 1, large: 1 };
    abyss.stepCount = ABYSS_TIME_BUDGET_S * STEPS_PER_SECOND - 1;
    abyss.step(); // crosses the budget → reachDoor → completion
    expect(abyss.isOver).toBe(true);

    const breakdown = abyss.currentBreakdown();

    /* Every prior component survived both hops. */
    expect(breakdown.surfaceTime).toBe(SURFACE_TIME);
    expect(breakdown.tunnelTime).toBe(TUNNEL_BANKED);
    expect(breakdown.abyssTime).toBe(ABYSS_TIME_BUDGET_S);
    expect(breakdown.stalactites).toEqual({ small: 2, medium: 1, large: 1 });

    const stalactiteBonus = 2 * STALACTITE_POINTS.small + STALACTITE_POINTS.medium + STALACTITE_POINTS.large;
    const levelsBonus = (SURFACE_LEVELS + TOTAL_CYCLES + ABYSS_LEVEL_CONFIG.length) * LEVEL_POINTS;
    expect(breakdown.stalactiteBonus).toBe(stalactiteBonus);
    expect(breakdown.levelsBonus).toBe(levelsBonus);

    /* The total equals the sum of all three worlds — nothing dropped at any handoff. */
    expect(breakdown.total).toBe(SURFACE_TIME + TUNNEL_BANKED + ABYSS_TIME_BUDGET_S + stalactiteBonus + levelsBonus);
  });
});

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
    stubAnimationFrame(); // restore noop rAF after unstubAllGlobals
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
    stubAnimationFrame(); // restore noop rAF after unstubAllGlobals
  });

  it('completion routes into the Abyss cold-open, not the win screen', () => {
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
    game['host']['frame'](); // settle fires the completion route → Abyss fall transition
    /* The collapse-shaft transition plays first; it lands in the Abyss after it
       (TRANSITION_TOTAL_MS + TRANSITION_BREATH_MS), not the win Game Over */
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

describe('win variant end screen (Abyss completion)', () => {
  let audioSrcs: string[] = [];
  let abysses: AbyssGame[] = [];

  beforeAll(() => {
    stubAnimationFrame();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', SettledImage);
    ({ sources: audioSrcs } = stubAudioTracking());
    abysses = [];
    const origStart = AbyssGame.prototype.startGame;
    vi.spyOn(AbyssGame.prototype, 'startGame').mockImplementation(function (this: AbyssGame) {
      abysses.push(this);
      origStart.call(this);
    });
    localStorage.setItem('audio-muted', '0');
    localStorage.setItem('surface-modal-dismissed', '1');
    localStorage.setItem('tunnel-modal-dismissed', '1');
    localStorage.setItem('abyss-modal-dismissed', '1');
    bootDebugScreen('abyss');
  });

  afterEach(() => {
    history.replaceState(null, '', '/');
    localStorage.removeItem('audio-muted');
    localStorage.removeItem('surface-modal-dismissed');
    localStorage.removeItem('tunnel-modal-dismissed');
    localStorage.removeItem('abyss-modal-dismissed');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    stubAnimationFrame(); // restore noop rAF after unstubAllGlobals
  });

  it('exit-door close → win score → The End → ranking; DIE never plays; ranking music starts once, at the ranking', () => {
    vi.advanceTimersByTime(2000); // through the cold-open → modal (dismissed) → startGame
    const game = abysses[0];
    expect(game).toBeDefined();
    const sfx = vi.spyOn(game.sfx, 'play');
    if (game.player) game.player.lives = Number.MAX_SAFE_INTEGER;
    game.stepCount = ABYSS_TIME_BUDGET_S * 60 - 1;
    game.step(); // crosses the L3 time budget → reachDoor (completion)
    expect(game.isOver).toBe(true);
    game['host']['frame'](); // settle fires endRun → exit-door close

    vi.advanceTimersByTime(1000); // EXIT_TOTAL_MS → LETSGO + onComplete → win Game Over
    expect(sfx).toHaveBeenCalledWith('letsgo');

    const winCanvas = document.querySelector('.win-canvas') as HTMLCanvasElement | null;
    expect(winCanvas).not.toBeNull();
    expect(winCanvas!.width).toBeGreaterThan(0);
    expect(document.querySelectorAll('.go-count-line').length).toBeGreaterThan(0);
    expect(audioSrcs.some((src) => /die\.wav/i.test(src))).toBe(false);

    const rankingStarts = () => audioSrcs.filter((src) => /reed-flutes/i.test(src)).length;

    vi.advanceTimersByTime(2500); // count + roll done...
    expect(rankingStarts()).toBe(0); // ...the win tally does NOT start the ranking music
    vi.advanceTimersByTime(2600); // through the extended win hold → The End mounts
    expect(document.querySelector('.the-end-screen')).not.toBeNull();
    expect(document.querySelector('.ranking-screen')).toBeNull();
    expect(audioSrcs.some((src) => /tim_2/i.test(src))).toBe(true); // the finale loop, not the ranking's
    expect(rankingStarts()).toBe(0);

    vi.advanceTimersByTime(20000); // The End cinematic (auto lift-off → ascend → credits) → ranking
    expect(document.querySelector('.ranking-screen')).not.toBeNull();
    expect(rankingStarts()).toBe(1); // exactly once, at the ranking
  });

  it('keeps the ranking music gated until the ranking — the win tally and The End never start it', () => {
    vi.advanceTimersByTime(2000); // cold-open → modal (dismissed) → startGame
    const game = abysses[0];
    if (game.player) game.player.lives = Number.MAX_SAFE_INTEGER;
    game.stepCount = ABYSS_TIME_BUDGET_S * 60 - 1;
    game.step();                  // crosses the budget → completion
    game['host']['frame']();      // settle → exit-door close
    vi.advanceTimersByTime(1000); // EXIT_TOTAL_MS → win tally begins

    const total = String(game.currentBreakdown().total);
    const rankingStarts = () => audioSrcs.filter((src) => /reed-flutes/i.test(src)).length;
    const shownScore = () => document.querySelector('.go-score-value')?.textContent;

    /* The ranking music stays silent through the whole count roll... */
    for (let t = 0; t < 1700; t += 100) {
      if (shownScore() !== total) expect(rankingStarts()).toBe(0);
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(1000);
    expect(shownScore()).toBe(total); // the roll landed on the real total
    /* ...and does NOT start at count completion — The End comes next, owning the music. */
    expect(rankingStarts()).toBe(0);
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(`Score: ${total}`);

    vi.advanceTimersByTime(30000); // win hold → The End → its cinematic → ranking
    expect(document.querySelector('.ranking-screen')).not.toBeNull();
    expect(rankingStarts()).toBe(1); // only now, exactly once
  });
});

describe('The End finale screen', () => {
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
    stubAnimationFrame(); // restore noop rAF after unstubAllGlobals
  });

  it('mounts the finale with its own loop, not the ranking music', () => {
    expect(document.querySelector('.the-end-screen')).not.toBeNull();
    expect(audioSrcs.some((s) => /tim_2/i.test(s))).toBe(true);       // 109 finale loop
    expect(audioSrcs.some((s) => /reed-flutes/i.test(s))).toBe(false);
    expect(document.querySelector('.ranking-screen')).toBeNull();
  });

  it('plays the balloon SFX after boarding, at ascent start — never before', () => {
    const balloonPlayed = (): boolean => audioSrcs.some((s) => /balloon/i.test(s));
    vi.advanceTimersByTime(THE_END_WALK_MS + THE_END_PROMPT_HOLD_MS); // auto lift-off fires → boarding begins
    expect(balloonPlayed()).toBe(false); // not at boarding
    vi.advanceTimersByTime(THE_END_BOARD_MS); // board done → ascent start
    expect(balloonPlayed()).toBe(true);
  });

  it('a press lifts off immediately, without waiting out the prompt hold', () => {
    const balloonPlayed = (): boolean => audioSrcs.some((s) => /balloon/i.test(s));
    vi.advanceTimersByTime(1500); // walk done, prompt up — well before the auto lift-off
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    vi.advanceTimersByTime(THE_END_BOARD_MS); // board → ascent SFX
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

    expect(document.querySelector('.the-end-credits--static')).not.toBeNull(); // static credits, no crawl
    vi.advanceTimersByTime(THE_END_END_HOLD_MS); // → ranking
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

    expect(drawImage).not.toHaveBeenCalled(); // first draw: ready() still false
    vi.advanceTimersByTime(0); // load settles → redraw with decoded assets
    expect(drawImage).toHaveBeenCalled();

    restoreMatchMedia();
  });
});

describe('leaderboard fetch timeout', () => {
  beforeAll(() => {
    stubAnimationFrame();
  });

  beforeEach(() => {
    gameInstances.length = 0;
    localStorage.setItem('surface-modal-dismissed', '1');
    localStorage.setItem('audio-muted', '1');
    mountSiteMain();
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
