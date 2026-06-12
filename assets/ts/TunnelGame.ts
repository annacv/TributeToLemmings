import { Player } from './Player';
import { GameLoop } from './lib/GameLoop';
import { RunLifecycle } from './lib/RunLifecycle';
import { Hud } from './lib/Hud';
import { restartAnimation } from './lib/fx';
import * as audio from './lib/audio';
import {
  makeBreakdown, livesBonusPoints, CYCLE_CLEAR_POINTS, type ScoreBreakdown,
} from './lib/score';
import {
  SPRITES, CRACK_MARK_SVGS,
  FIRE_SFX, BANG_SFX, TENTON_SFX, EXPLODE_SFX, CHAIN_SFX, SCRAPE_SFX,
  TUNNEL_BACKGROUND_SVG, TUNNEL_CEILING_SVG,
} from './assets';

/* Scoring/timing (run-scoring spec): one visible budget for the whole screen,
   derived from step counting; it floors at 0 and never kills — the ceiling does. */
export const TUNNEL_TIME_BUDGET_S = 60;
export const TOTAL_CYCLES = 3;
const STEPS_PER_SECOND = 60;

/* World geometry as canvas fractions (the canvas resizes 280–580 px; px-stored
   heights would teleport on resize). Asset-baked values follow the artwork. */
export const FLOOR_FRAC = 690 / 800;          // walkable line in background-tunnel.svg
const CEILING_ASPECT = 480 / 800;             // tunnel-ceiling.svg strip
const CEILING_TOOTH_FRAC = 474 / 480;         // deepest tooth: the collision line, never per-tooth

/* Kill line and telegraph band, floor-to-ceiling headroom (D10). The crouch
   telegraph must always read before the crush can fire. */
export const CRUSH_HEADROOM_FRAC = 0.09;
export const TELEGRAPH_HEADROOM_FRAC = 0.17;
const CRUSH_HITSTOP_STEPS = 15;               // ~250 ms freeze: the death beat reads without sound or shake

/* Per-level tunables (round-3 ratified): L2 lowers the start, L3 also drifts
   faster. The solvability invariant over this table is pinned by tests:
   time-to-crush exceeds the budget on levels 1–2; only level 3 can crush
   within it (no sooner than ~40 s). */
export const TUNNEL_LEVELS = [
  { startHeadroomFrac: 0.62, driftPerStep: 0.00009, crackAssets: [0, 1] },
  { startHeadroomFrac: 0.48, driftPerStep: 0.00009, crackAssets: [1] },
  { startHeadroomFrac: 0.34, driftPerStep: 0.000102, crackAssets: [0] },
] as const;

const STAGED_EVENT_STEPS = 48;                // ~800 ms between-cycle lowering event
const FUSE_STEPS = 120;                       // ~2 s lit fuse before the breach

/* Abyss tease beat sequence (round-4 ratified, ~3.3 s total): cave loop fades
   while the smoke hangs, clears sideways frame-right, rust spills in, the
   lemming walks out right, the stinger breathes, hard cut. Under reduced
   motion the wipe is skipped: cleared frame + rust + right-facing lemming. */
const TEASE_FADE_STEPS = 60;
const TEASE_HANG_STEPS = 24;
const TEASE_WIPE_STEPS = 54;
const TEASE_WALK_STEPS = 42;
const TEASE_REDUCED_HOLD_STEPS = 90;
const TEASE_STINGER_STEPS = 72;
const TEASE_CUT_STEPS = 3;
const TEASE_RUST = '#A85A1C';
const TEASE_RUST_MAX_ALPHA = 0.18;
const LIGHT_PRESSES = 3;
const ACTION_RANGE_FRAC = 0.08;               // how close "near the bomb / at the crack" is
export const MIN_CRACK_SPAWN_DIST_FRAC = 0.18;
const PLAYER_SPAWN_X_FRAC = 0.08;
const CRACK_MIN_X_FRAC = 0.06;
const CRACK_MAX_X_FRAC = 0.88;

/* One verb per state (D4): what Space (or the touch button) means right now.
   `tease` is the post-victory beat: input inert, countdown frozen, no crush. */
export type TunnelState = 'explore' | 'carry' | 'placed' | 'armed' | 'event' | 'tease';
export type TunnelVerb = 'pick up' | 'place' | 'light' | null;

export class TunnelGame {
  player: Player | null;
  isOver: boolean;
  paused: boolean;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: TunnelState;
  cycle: number;                              // 0-based index into TUNNEL_LEVELS
  ceilingFrac: number;                        // collision line, canvas fraction from the top
  crackXFrac: number;
  bombXFrac: number;
  bombSpawnXFrac: number;
  carrying: boolean;
  lightPresses: number;
  fuseStepsLeft: number;
  stepCount: number;
  bankedSeconds: number;
  cyclesCleared: number;
  onGameOver: ((breakdown: ScoreBreakdown) => void) | null;
  onComplete: ((breakdown: ScoreBreakdown) => void) | null;
  caveLoop: HTMLAudioElement | null;
  fuseTickSfx: HTMLAudioElement;
  breachSfx: HTMLAudioElement;
  crushSfx: HTMLAudioElement;
  pickupSfx: HTMLAudioElement;
  rumbleSfx: HTMLAudioElement;
  scrapeSfx: HTMLAudioElement;
  muted: boolean;
  private readonly baseBreakdown: ScoreBreakdown;
  private eventStepsLeft: number;
  private eventFromFrac: number;
  private hitstopStepsLeft: number;
  private crushFlashStepsLeft: number;
  /* The telegraph rumble plays once per descent into the danger band; it
     re-arms whenever the ceiling resets (new cycle, respawn) */
  private telegraphArmed: boolean;
  private teaseStep: number;
  private readonly reduceMotion: boolean;
  private hud: Hud;
  private gameLoop: GameLoop;
  private run = new RunLifecycle();
  private backgroundImg: HTMLImageElement;
  private ceilingImg: HTMLImageElement;
  private crackImgs: HTMLImageElement[];
  private bombImg: HTMLImageElement;

  constructor(canvas: HTMLCanvasElement, baseBreakdown: ScoreBreakdown) {
    this.player = null;
    this.isOver = false;
    this.paused = false;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.baseBreakdown = baseBreakdown;
    this.state = 'explore';
    this.cycle = 0;
    this.ceilingFrac = this.cycleStartCeilingFrac(0);
    this.crackXFrac = 0.5;
    this.bombXFrac = 0.5;
    this.bombSpawnXFrac = 0.5;
    this.carrying = false;
    this.lightPresses = 0;
    this.fuseStepsLeft = 0;
    this.stepCount = 0;
    this.bankedSeconds = 0;
    this.cyclesCleared = 0;
    this.eventStepsLeft = 0;
    this.eventFromFrac = 0;
    this.hitstopStepsLeft = 0;
    this.crushFlashStepsLeft = 0;
    this.telegraphArmed = true;
    this.teaseStep = 0;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.onGameOver = null;
    this.onComplete = null;
    this.caveLoop = null;
    this.muted = localStorage.getItem('audio-muted') === '1';
    this.hud = new Hud();

    this.fuseTickSfx = new Audio(FIRE_SFX);
    this.breachSfx = new Audio(BANG_SFX);
    this.crushSfx = new Audio(TENTON_SFX);
    this.pickupSfx = new Audio(EXPLODE_SFX);
    this.rumbleSfx = new Audio(CHAIN_SFX);
    this.scrapeSfx = new Audio(SCRAPE_SFX);

    const loadImg = (src: string) => {
      const img = new Image();
      img.src = src;
      return img;
    };
    this.backgroundImg = loadImg(TUNNEL_BACKGROUND_SVG);
    this.ceilingImg = loadImg(TUNNEL_CEILING_SVG);
    this.crackImgs = CRACK_MARK_SVGS.map(loadImg);
    this.bombImg = loadImg(SPRITES.bomb);

    this.gameLoop = new GameLoop({
      step: () => this.step(),
      render: () => this.renderFrame(),
    });
  }

  get runSignal(): AbortSignal {
    return this.run.signal;
  }

  gameOverCallback(callback: (breakdown: ScoreBreakdown) => void): void {
    this.onGameOver = callback;
  }

  completionCallback(callback: (breakdown: ScoreBreakdown) => void): void {
    this.onComplete = callback;
  }

  startGame(): void {
    this.player = new Player(this.canvas);
    this.player.dx = this.canvas.width * PLAYER_SPAWN_X_FRAC;
    this.player.dy = this.canvas.height * FLOOR_FRAC - this.player.dHeight;
    this.hud.initLivesIcons(this.player.lives, SPRITES.lemming);
    this.hud.setText('.lives-value', String(this.player.lives));
    this.hud.setLevel(`depth 1/${TOTAL_CYCLES}`);
    /* Entry signals the rule change: the score slot now counts down */
    this.hud.setScore(this.secondsLeft());
    this.hud.blinkItem('.hud-score');
    this.beginCycle(0);
    this.gameLoop.start();
  }

  /** Label for the contextual touch button: exactly one meaning per state. */
  currentVerb(): TunnelVerb {
    if (this.state === 'explore' && this.nearBomb()) return 'pick up';
    if (this.state === 'carry' && this.atCrack()) return 'place';
    if (this.state === 'placed') return 'light';
    return null;
  }

  /** The single action verb (Space / touch button). One meaning per state (D4). */
  action(): void {
    if (this.paused || this.isOver || this.hitstopStepsLeft > 0) return;
    if (this.state === 'explore' && this.nearBomb()) {
      this.carrying = true;
      this.state = 'carry';
      audio.playSfx(this.pickupSfx, this.muted);
    } else if (this.state === 'carry' && this.atCrack()) {
      this.carrying = false;
      this.bombXFrac = this.crackXFrac;
      this.state = 'placed';
      this.lightPresses = 0;
    } else if (this.state === 'placed') {
      this.lightPresses++;
      /* Match-strike per light press; the third one ignites the fuse loop */
      audio.playSfx(this.scrapeSfx, this.muted);
      if (this.lightPresses >= LIGHT_PRESSES) {
        this.state = 'armed';
        this.fuseStepsLeft = FUSE_STEPS;
        audio.playLoop(this.fuseTickSfx, this.muted);
      }
    }
  }

  secondsLeft(): number {
    return Math.max(0, TUNNEL_TIME_BUDGET_S - Math.floor(this.stepCount / STEPS_PER_SECOND));
  }

  headroomFrac(): number {
    return FLOOR_FRAC - this.ceilingFrac;
  }

  /** The breakdown if the run ended right now: banked values only — the
      unbanked remainder of the current cycle dies with the lemming. */
  currentBreakdown(): ScoreBreakdown {
    return makeBreakdown({
      surface: this.baseBreakdown.surface,
      livesBonus: this.baseBreakdown.livesBonus,
      tunnelTime: this.bankedSeconds,
      cyclesBonus: this.cyclesCleared * CYCLE_CLEAR_POINTS,
    });
  }

  private completionBreakdown(): ScoreBreakdown {
    /* Lives convert at every screen transition — completing the tunnel is one */
    const base = this.currentBreakdown();
    return makeBreakdown({
      surface: base.surface,
      livesBonus: base.livesBonus + livesBonusPoints(this.player?.lives ?? 0),
      tunnelTime: base.tunnelTime,
      cyclesBonus: base.cyclesBonus,
    });
  }

  private cycleStartCeilingFrac(cycle: number): number {
    return FLOOR_FRAC - TUNNEL_LEVELS[cycle].startHeadroomFrac;
  }

  private nearBomb(): boolean {
    if (!this.player) return false;
    const playerCenter = (this.player.dx + this.player.dWidth / 2) / this.canvas.width;
    return Math.abs(playerCenter - this.bombXFrac) <= ACTION_RANGE_FRAC;
  }

  private atCrack(): boolean {
    if (!this.player) return false;
    const playerCenter = (this.player.dx + this.player.dWidth / 2) / this.canvas.width;
    return Math.abs(playerCenter - this.crackXFrac) <= ACTION_RANGE_FRAC;
  }

  /** Random crack position, re-rolled per cycle and per crush respawn; never
      within MIN_CRACK_SPAWN_DIST of the spawn point (free discovery). */
  private rollCrackPosition(): number {
    let x: number;
    do {
      x = CRACK_MIN_X_FRAC + Math.random() * (CRACK_MAX_X_FRAC - CRACK_MIN_X_FRAC);
    } while (Math.abs(x - PLAYER_SPAWN_X_FRAC) < MIN_CRACK_SPAWN_DIST_FRAC);
    return x;
  }

  private beginCycle(cycle: number): void {
    this.cycle = cycle;
    this.state = 'explore';
    this.carrying = false;
    this.lightPresses = 0;
    this.fuseStepsLeft = 0;
    this.crackXFrac = this.rollCrackPosition();
    /* The pickable bomb spawns away from the crack so the route matters */
    do {
      this.bombSpawnXFrac = CRACK_MIN_X_FRAC + Math.random() * (CRACK_MAX_X_FRAC - CRACK_MIN_X_FRAC);
    } while (Math.abs(this.bombSpawnXFrac - this.crackXFrac) < MIN_CRACK_SPAWN_DIST_FRAC);
    this.bombXFrac = this.bombSpawnXFrac;
    this.hud.setLevel(`depth ${cycle + 1}/${TOTAL_CYCLES}`);
  }

  /** Per-cycle banking: each breakout secures an equal share of the still
      unbanked remaining seconds; the final breakout banks all of it. The
      invariant test pins this rule (design.md open question, resolved). */
  private bankShare(): number {
    const unbanked = Math.max(0, this.secondsLeft() - this.bankedSeconds);
    const cyclesLeft = TOTAL_CYCLES - this.cyclesCleared;
    return cyclesLeft > 1 ? Math.floor(unbanked / cyclesLeft) : unbanked;
  }

  private breach(): void {
    audio.stopLoop(this.fuseTickSfx);
    audio.playSfx(this.breachSfx, this.muted);
    const share = this.bankShare();
    this.bankedSeconds += share;
    this.cyclesCleared++;
    this.hud.setScore(this.secondsLeft());
    this.showBankPop(share + CYCLE_CLEAR_POINTS);

    if (this.cyclesCleared >= TOTAL_CYCLES) {
      /* Drift stays suspended from here through the tease: the win cannot be
         crushed after the bank latch (round-4 guard) */
      this.state = 'tease';
      this.teaseStep = 0;
      return;
    }
    /* Staged lowering event into the next cycle: drift suspended, ~800 ms,
       step-counted so pause mid-event cannot desync it. The shake rides the
       existing CSS animation, which the global reduced-motion clamp covers. */
    this.state = 'event';
    this.eventStepsLeft = STAGED_EVENT_STEPS;
    this.eventFromFrac = this.ceilingFrac;
    audio.playSfx(this.rumbleSfx, this.muted);
    restartAnimation(this.canvas, 'shake-light');
  }

  /** "+N" pop at the banking moment, near the score slot. */
  private showBankPop(points: number): void {
    const slot = this.hud.el('.hud-score');
    if (!slot) return;
    const pop = document.createElement('span');
    pop.className = 'bank-pop';
    pop.textContent = `+${points}`;
    slot.appendChild(pop);
    pop.addEventListener('animationend', () => pop.remove(), { once: true });
  }

  private handleCrush(): void {
    if (!this.player) return;
    this.player.lives--;
    this.hud.displayLives(this.player.lives);
    audio.stopLoop(this.fuseTickSfx);
    audio.playSfx(this.crushSfx, this.muted);
    /* Hit-stop + flash: the death beat must read muted and under reduced
       motion (it is a freeze and a flash, not shake) */
    this.hitstopStepsLeft = CRUSH_HITSTOP_STEPS;
    this.crushFlashStepsLeft = CRUSH_HITSTOP_STEPS;

    if (this.player.lives < 1) {
      this.isOver = true;
      return;
    }
    /* Respawn rule (round-3, Anna's clarified intent): same cycle, remaining
       countdown, same crack appearance, new crack position, ceiling reset to
       the cycle's start height. A carried bomb returns to its pickup spawn;
       a placed one is removed with the old crack (same reset). */
    this.ceilingFrac = this.cycleStartCeilingFrac(this.cycle);
    this.telegraphArmed = true;
    this.player.dx = this.canvas.width * PLAYER_SPAWN_X_FRAC;
    this.player.direction = 0;
    this.state = 'explore';
    this.carrying = false;
    this.lightPresses = 0;
    this.fuseStepsLeft = 0;
    this.crackXFrac = this.rollCrackPosition();
    this.bombXFrac = this.bombSpawnXFrac;
  }

  /** One fixed 1/60 s simulation step; returns false to halt the loop. */
  step(): boolean {
    if (this.isOver) return false;
    /* Pause is a consumer-side flag: render stays alive under the modal */
    if (this.paused) return true;
    if (this.hitstopStepsLeft > 0) {
      this.hitstopStepsLeft--;
      return true;
    }
    if (this.crushFlashStepsLeft > 0) this.crushFlashStepsLeft--;

    /* The tease freezes the countdown and the world; only its beats advance */
    if (this.state === 'tease') {
      this.stepTease();
      return true;
    }

    this.stepCount++;
    this.hud.setScore(this.secondsLeft());
    /* ≤10 s warning: color + 1 Hz pulse (the global reduced-motion clamp
       collapses the pulse to color-only) */
    this.hud.el('.seconds-value')?.classList.toggle('time-warning', this.secondsLeft() <= 10);

    if (this.state === 'event') {
      /* Staged lowering: interpolate to the next cycle's start, then begin it */
      this.eventStepsLeft--;
      const target = this.cycleStartCeilingFrac(this.cyclesCleared);
      const t = 1 - this.eventStepsLeft / STAGED_EVENT_STEPS;
      this.ceilingFrac = this.eventFromFrac + (target - this.eventFromFrac) * t;
      if (this.eventStepsLeft <= 0) {
        this.ceilingFrac = target;
        this.telegraphArmed = true;
        this.beginCycle(this.cyclesCleared);
      }
      return true;
    }

    /* Continuous drift (D10): per-step descent at the level's velocity —
       reduced motion never stops it; it is gameplay, not decoration */
    this.ceilingFrac += TUNNEL_LEVELS[this.cycle].driftPerStep;

    if (this.telegraphArmed && this.inTelegraphBand()) {
      this.telegraphArmed = false;
      audio.playSfx(this.rumbleSfx, this.muted);
    }

    if (this.headroomFrac() <= CRUSH_HEADROOM_FRAC) {
      this.handleCrush();
      return true;
    }

    this.player?.move();
    this.player?.tickBlink();

    if (this.state === 'armed') {
      this.fuseStepsLeft--;
      if (this.fuseStepsLeft <= 0) this.breach();
    }
    return true;
  }

  /** Beat thresholds for the tease, in tease-steps. Reduced motion skips the
      wipe and holds the cleared frame instead. */
  private teaseBeats() {
    const wipeEnd = this.reduceMotion ? 0 : TEASE_HANG_STEPS + TEASE_WIPE_STEPS;
    const walkEnd = wipeEnd + (this.reduceMotion ? TEASE_REDUCED_HOLD_STEPS : TEASE_WALK_STEPS);
    const stingerEnd = walkEnd + TEASE_STINGER_STEPS;
    return { wipeEnd, walkEnd, stingerEnd, cutEnd: stingerEnd + TEASE_CUT_STEPS };
  }

  private stepTease(): void {
    this.teaseStep++;
    const { wipeEnd, walkEnd, cutEnd } = this.teaseBeats();
    /* Cave loop fades out under the hanging smoke; silence is the held breath */
    if (this.caveLoop) {
      this.caveLoop.volume = Math.max(0, 1 - this.teaseStep / TEASE_FADE_STEPS);
    }
    if (this.player && this.teaseStep > wipeEnd) {
      /* He fell in; he walks out under his own power (optional rider, 8.1b) */
      this.player.direction = 1;
      if (this.teaseStep <= walkEnd) this.player.dx += this.player.speed * 1.5;
    }
    if (this.teaseStep === walkEnd) {
      this.hud.el('.tbc-overlay')?.classList.add('show');
    }
    if (this.teaseStep >= cutEnd) {
      this.isOver = true;
    }
  }

  private renderFrame(): void {
    this.drawScene();
    /* Extra frames can draw after the halt — teardown fires exactly once, and
       exactly one of {bank-completion, death} resolves through this latch */
    this.run.settle(this.isOver, () => this.endRun());
  }

  private endRun(): void {
    if (this.caveLoop) audio.stopLoop(this.caveLoop);
    audio.stopLoop(this.fuseTickSfx);
    if (this.cyclesCleared >= TOTAL_CYCLES) {
      this.onComplete?.(this.completionBreakdown());
    } else {
      this.onGameOver?.(this.currentBreakdown());
    }
  }

  /** Near-crush telegraph: crouch frame + rumble before the kill line. */
  inTelegraphBand(): boolean {
    return this.headroomFrac() <= TELEGRAPH_HEADROOM_FRAC;
  }

  private drawScene(): void {
    const { ctx, canvas } = this;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, canvas.height);

    if (this.backgroundImg.complete && this.backgroundImg.naturalWidth > 0) {
      ctx.drawImage(this.backgroundImg, 0, 0, size, canvas.height);
    }

    /* Crack marks sit on the back wall above the floor shelf */
    const crackW = size * 0.12;
    const crackY = canvas.height * FLOOR_FRAC - crackW * 1.4;
    for (const idx of TUNNEL_LEVELS[this.cycle].crackAssets) {
      const img = this.crackImgs[idx];
      if (img?.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, this.crackXFrac * size - crackW / 2, crackY, crackW, crackW);
      }
    }

    /* The pickable bomb (when not carried or placed it rests on the floor) */
    if (!this.carrying && this.bombImg.complete && this.bombImg.naturalWidth > 0) {
      const bombW = 28;
      const bombH = 32;
      const bombY = this.state === 'placed' || this.state === 'armed'
        ? crackY + crackW - bombH
        : canvas.height * FLOOR_FRAC - bombH;
      ctx.drawImage(this.bombImg, this.bombXFrac * size - bombW / 2, bombY, bombW, bombH);

      /* Visual fuse countdown: code-drawn digits over the armed bomb (the
         spark frames are an optional asset; the digits never depend on it) */
      if (this.state === 'armed') {
        const fuseSeconds = Math.ceil(this.fuseStepsLeft / 60);
        ctx.font = `${Math.round(size * 0.05)}px monospace`;
        ctx.fillStyle = '#A85A1C';
        ctx.fillText(String(fuseSeconds), this.bombXFrac * size - bombW / 2, bombY - 6);
      }
    }

    if (this.player) {
      const crouching = this.state !== 'tease' && this.inTelegraphBand();
      if (crouching) {
        /* Crouch read: vertical squash anchored at the feet */
        ctx.save();
        ctx.translate(0, canvas.height * FLOOR_FRAC * 0.2);
        ctx.scale(1, 0.8);
        this.player.drawImage(this.stepCount);
        ctx.restore();
      } else {
        this.player.drawImage(this.stepCount);
      }
    }

    /* Ceiling strip last: solid mass overflows above the canvas top; the
       deepest tooth of the artwork rides the collision line */
    if (this.ceilingImg.complete && this.ceilingImg.naturalWidth > 0) {
      const drawH = size * CEILING_ASPECT;
      const drawY = this.ceilingFrac * canvas.height - drawH * CEILING_TOOTH_FRAC;
      ctx.drawImage(this.ceilingImg, 0, drawY, size, drawH);
    }

    if (this.crushFlashStepsLeft > 0) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, canvas.height);
      ctx.globalAlpha = 1;
    }

    if (this.state === 'tease') this.drawTease();
  }

  /** Tease overlays: hanging smoke that wipes frame-right, the rust spill
      bleeding in from the right edge, and the final hard cut to black. */
  private drawTease(): void {
    const { ctx, canvas } = this;
    const size = canvas.width;
    const { wipeEnd, stingerEnd, cutEnd } = this.teaseBeats();

    if (!this.reduceMotion && this.teaseStep < wipeEnd) {
      /* Smoke hangs, then clears sideways toward frame-right */
      const wipeT = Math.max(0, (this.teaseStep - TEASE_HANG_STEPS) / TEASE_WIPE_STEPS);
      const eased = wipeT * (2 - wipeT); // easeOutQuad
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#28221A';
      ctx.fillRect(eased * size, 0, size - eased * size, canvas.height);
      ctx.globalAlpha = 1;
    }

    /* Faint warm rust spill from frame-right: direction, never destination */
    const rustT = this.reduceMotion
      ? 1
      : Math.min(1, Math.max(0, (this.teaseStep - TEASE_HANG_STEPS) / TEASE_WIPE_STEPS));
    if (rustT > 0) {
      ctx.globalAlpha = TEASE_RUST_MAX_ALPHA * rustT;
      ctx.fillStyle = TEASE_RUST;
      ctx.fillRect(size * 0.7, 0, size * 0.3, canvas.height);
      ctx.globalAlpha = 1;
    }

    if (this.teaseStep >= stingerEnd && this.teaseStep < cutEnd) {
      /* Hard cut to black, 2–3 frames, brutal and retro */
      ctx.fillStyle = '#010106';
      ctx.fillRect(0, 0, size, canvas.height);
    }
  }
}
