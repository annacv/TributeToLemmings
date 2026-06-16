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
  SPRITES, CRACK_MARK_SVGS, GROUND_HOLE_SVGS,
  FIRE_SFX, BANG_SFX, TENTON_SFX, EXPLODE_SFX, CHAIN_SFX, SCRAPE_SFX, FALLING_SFX,
  TUNNEL_BACKGROUND_SVG, TUNNEL_CEILING_SVG,
} from './assets';

export const TUNNEL_TIME_BUDGET_S = 60;
export const TOTAL_CYCLES = 3;
const STEPS_PER_SECOND = 60;

/* World geometry is stored as canvas fractions, not pixels, so nothing jumps
   when the canvas resizes (280–580 px). The numbers come from the artwork. */
export const FLOOR_FRAC = 690 / 800;  // walkable line in background-tunnel.svg
const CEILING_ASPECT = 800 / 800;     // tunnel-ceiling.svg strip
const CEILING_TOOTH_FRAC = 794 / 800; // deepest tooth: the collision line, never per-tooth

/* Kill line and warning band, both as floor-to-ceiling headroom. The rule:
   the crouch warning must always show before the crush can fire. */
export const CRUSH_HEADROOM_FRAC = 0.09;
export const WARNING_HEADROOM_FRAC = 0.17;

const CRUSH_HITSTOP_STEPS = 15;      // ~250 ms freeze so the death beat lands

export const TUNNEL_LEVELS = [
  { startHeadroomFrac: 0.62, driftPerStep: 0.00009, crackMark: 2, bombs: 2 },
  { startHeadroomFrac: 0.48, driftPerStep: 0.00009, crackMark: 0, bombs: 3 },
  { startHeadroomFrac: 0.34, driftPerStep: 0.00013, crackMark: 1, bombs: 4 },
] as const;

const EVENT_SHAKE_STEPS = 18;       // ~300 ms ground-shake warning before the ceiling falls
const STAGED_EVENT_STEPS = 48;      // ~800 ms ceiling drop opening each new level
const MIN_EVENT_DROP_FRAC = 0.05;   // the drop must read even if drift already passed the next start
const FUSE_STEPS = 120;             // ~2 s lit fuse before the explosion

/* Breach sequence between cycles: the booom blasts a floor pit open (frames
   0→3), the camera drops into the next-deeper chamber, then the pit seals
   overhead (3→0) before the next level is announced and the ceiling drops in. */
export const BREACH_BOOM_STEPS = 42; // ~0.7 s booom.svg + pit blasting open
export const BREACH_PAN_STEPS = 72;  // ~1.2 s camera drop into the next chamber
export const BREACH_SEAL_STEPS = 36; // ~0.6 s the pit sealing overhead
export const BREACH_PAN_END_STEPS = BREACH_BOOM_STEPS + BREACH_PAN_STEPS;  // arrival beat
export const BREACH_TOTAL_STEPS = BREACH_PAN_END_STEPS + BREACH_SEAL_STEPS;

const RUST_ACCENT = '#A85A1C';
const LIGHT_PRESSES = 3;
const ACTION_RANGE_FRAC = 0.08;      // how close "near a bomb" is
export const CRACK_RANGE_FRAC = 0.1; // how close "at the floor crack" is
const PLAYER_SPAWN_X_FRAC = 0.08;

/* Bombs spawn in the middle band, apart from each other, so the route matters */
const BOMB_MIN_X_FRAC = 0.18;
const BOMB_MAX_X_FRAC = 0.82;
const BOMB_MIN_GAP_FRAC = 0.12;

/* The crack sits at a random floor x, off the spawn point and this cycle's bombs */
export const CRACK_MIN_X_FRAC = 0.18;
export const CRACK_MAX_X_FRAC = 0.82;
const CRACK_MARK_HEIGHT_FRAC = 0.12;

/* Footing-pad one-shots: snap when he reaches the charge, beckon when he strays */
const PAD_ARRIVE_STEPS = 6;
const PAD_NUDGE_STEPS = 10;

export type TunnelState = 'explore' | 'carry' | 'placed' | 'armed' | 'breach' | 'event';
export type TunnelVerb = 'pick up' | 'place' | 'light' | null;

export class TunnelGame {
  player: Player | null;
  isOver: boolean;
  paused: boolean;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: TunnelState;
  cycle: number;        // 0-based index into TUNNEL_LEVELS
  ceilingFrac: number;  // collision line, canvas fraction from the top
  crackXFrac: number;
  floorBombs: number[];
  bombSpawns: number[]; // this cycle's spawn layout (for crush respawn)
  placedCount: number;
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
  fallingSfx: HTMLAudioElement;
  muted: boolean;
  breachStep: number;
  private readonly baseBreakdown: ScoreBreakdown;
  private eventStepsLeft: number;
  private eventShakeStepsLeft: number;
  private eventFromFrac: number;
  private eventTargetFrac: number;
  private hitstopStepsLeft: number;
  private crushFlashStepsLeft: number;
  private warningArmed: boolean;
  private readonly reduceMotion: boolean;
  private hud: Hud;
  private gameLoop: GameLoop;
  private run = new RunLifecycle();
  private padArriveSteps = 0;
  private padNudgeSteps = 0;
  private padNudgeDir = 1;
  private wasAtCrack = false;
  private backgroundImg: HTMLImageElement;
  private ceilingImg: HTMLImageElement;
  private crackImgs: HTMLImageElement[];
  private bombImg: HTMLImageElement;
  private booomImg: HTMLImageElement;
  private groundHoleImgs: HTMLImageElement[];

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
    this.floorBombs = [];
    this.bombSpawns = [];
    this.placedCount = 0;
    this.carrying = false;
    this.lightPresses = 0;
    this.fuseStepsLeft = 0;
    this.stepCount = 0;
    this.bankedSeconds = 0;
    this.cyclesCleared = 0;
    this.breachStep = 0;
    this.eventStepsLeft = 0;
    this.eventShakeStepsLeft = 0;
    this.eventFromFrac = 0;
    this.eventTargetFrac = 0;
    this.hitstopStepsLeft = 0;
    this.crushFlashStepsLeft = 0;
    this.warningArmed = true;
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
    this.fallingSfx = new Audio(FALLING_SFX);

    const loadImg = (src: string) => {
      const img = new Image();
      img.src = src;
      return img;
    };
    this.backgroundImg = loadImg(TUNNEL_BACKGROUND_SVG);
    this.ceilingImg = loadImg(TUNNEL_CEILING_SVG);
    this.crackImgs = CRACK_MARK_SVGS.map(loadImg);
    this.bombImg = loadImg(SPRITES.bomb);
    this.booomImg = loadImg(SPRITES.booom);
    this.groundHoleImgs = GROUND_HOLE_SVGS.map(loadImg);

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
    /* The score slot now counts down */
    this.hud.setScore(this.secondsLeft());
    this.hud.blinkItem('.hud-score');
    this.beginCycle(0);
    this.gameLoop.start();
  }

  /** The action verb available */
  currentVerb(): TunnelVerb {
    if (this.state === 'explore' && this.nearBombIndex() >= 0) return 'pick up';
    if (this.state === 'carry' && this.atCrack()) return 'place';
    if (this.state === 'placed' && this.atCrack()) return 'light';
    return null;
  }

  /** Perform the current action verb */
  action(): void {
    if (this.paused || this.isOver || this.hitstopStepsLeft > 0) return;
    if (this.state === 'explore') {
      const i = this.nearBombIndex();
      if (i < 0) return;
      this.floorBombs.splice(i, 1);
      this.carrying = true;
      this.state = 'carry';
      audio.playSfx(this.pickupSfx, this.muted);
    } else if (this.state === 'carry' && this.atCrack()) {
      this.carrying = false;
      this.placedCount++;
      audio.playSfx(this.pickupSfx, this.muted);
      this.state = this.placedCount >= TUNNEL_LEVELS[this.cycle].bombs ? 'placed' : 'explore';
      this.lightPresses = 0;
    } else if (this.state === 'placed' && this.atCrack()) {
      this.lightPresses++;
      this.scrapeSfx.volume = 1;
      audio.playSfx(this.scrapeSfx, this.muted);
      if (this.lightPresses >= LIGHT_PRESSES) {
        this.state = 'armed';
        this.fuseStepsLeft = FUSE_STEPS;
        if (this.player) this.player.direction = 0;
        audio.playLoop(this.fuseTickSfx, this.muted);
      }
    } else if (this.state === 'placed') {
      this.padNudgeSteps = PAD_NUDGE_STEPS;
      this.padNudgeDir = Math.sign(this.playerCenterFrac() - this.crackXFrac) || 1;
      this.scrapeSfx.volume = 0.3;
      audio.playSfx(this.scrapeSfx, this.muted);
    }
  }

  secondsLeft(): number {
    return Math.max(0, TUNNEL_TIME_BUDGET_S - Math.floor(this.stepCount / STEPS_PER_SECOND));
  }

  headroomFrac(): number {
    return FLOOR_FRAC - this.ceilingFrac;
  }

  /** Score if the run ended now — banked values only; the current cycle's
      unbanked time dies with the lemming. */
  currentBreakdown(): ScoreBreakdown {
    return makeBreakdown({
      surface: this.baseBreakdown.surface,
      livesBonus: this.baseBreakdown.livesBonus,
      tunnelTime: this.bankedSeconds,
      cyclesBonus: this.cyclesCleared * CYCLE_CLEAR_POINTS,
    });
  }

  private completionBreakdown(): ScoreBreakdown {
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

  private playerCenterFrac(): number {
    return this.player ? (this.player.dx + this.player.dWidth / 2) / this.canvas.width : 0.5;
  }

  private nearBombIndex(): number {
    if (!this.player) return -1;
    const center = this.playerCenterFrac();
    return this.floorBombs.findIndex((x) => Math.abs(center - x) <= ACTION_RANGE_FRAC);
  }

  private atCrack(): boolean {
    if (!this.player) return false;
    return Math.abs(this.playerCenterFrac() - this.crackXFrac) <= CRACK_RANGE_FRAC;
  }

  /** Random floor x for the crack, clear of the spawn and the cycle's bombs;
      re-rolled per cycle and per crush respawn. */
  private rollCrack(): void {
    const blocked = [PLAYER_SPAWN_X_FRAC, ...this.bombSpawns];
    const clearOf = (x: number) => Math.min(...blocked.map((b) => Math.abs(b - x)));

    for (let i = 0; i < 30; i++) {
      const x = CRACK_MIN_X_FRAC + Math.random() * (CRACK_MAX_X_FRAC - CRACK_MIN_X_FRAC);
      if (clearOf(x) >= BOMB_MIN_GAP_FRAC) { this.crackXFrac = x; return; }
    }
    /* Fallback: midpoint of the widest gap — the roomiest spot, always exists */
    const stops = [
      CRACK_MIN_X_FRAC,
      ...this.bombSpawns.filter((b) => b > CRACK_MIN_X_FRAC && b < CRACK_MAX_X_FRAC).sort((a, b) => a - b),
      CRACK_MAX_X_FRAC,
    ];
    let best = (CRACK_MIN_X_FRAC + CRACK_MAX_X_FRAC) / 2;
    let bestGap = -1;
    for (let i = 1; i < stops.length; i++) {
      const gap = stops[i] - stops[i - 1];
      if (gap > bestGap) { bestGap = gap; best = (stops[i] + stops[i - 1]) / 2; }
    }
    this.crackXFrac = best;
  }

  private rollBombs(count: number): number[] {
    const bombs: number[] = [];
    while (bombs.length < count) {
      const x = BOMB_MIN_X_FRAC + Math.random() * (BOMB_MAX_X_FRAC - BOMB_MIN_X_FRAC);
      if (bombs.every((b) => Math.abs(b - x) >= BOMB_MIN_GAP_FRAC)) bombs.push(x);
    }
    return bombs;
  }

  /** Clear in-progress carry/place/light/fuse and restore the floor bombs from
      this cycle's spawn layout. Shared by cycle setup and crush respawn. */
  private resetCycleProgress(): void {
    this.carrying = false;
    this.placedCount = 0;
    this.lightPresses = 0;
    this.fuseStepsLeft = 0;
    this.floorBombs = [...this.bombSpawns];
  }

  /** Lay out a cycle's crack + bombs without changing state, so a transition
      can stage them before gameplay resumes. */
  private setupCycle(cycle: number): void {
    this.cycle = cycle;
    this.bombSpawns = this.rollBombs(TUNNEL_LEVELS[cycle].bombs);
    this.resetCycleProgress();
    this.rollCrack();
    this.hud.setLevel(String(cycle + 1));
  }

  private beginCycle(cycle: number): void {
    this.setupCycle(cycle);
    this.state = 'explore';
  }

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
    restartAnimation(this.canvas, 'shake-light');

    /* Every cycle — including the last — opens the floor pit; the final breach
       hands off to the Abyss transition screen (main.ts) via the completion latch */
    this.state = 'breach';
    this.breachStep = 0;
  }

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
    this.hitstopStepsLeft = CRUSH_HITSTOP_STEPS;
    this.crushFlashStepsLeft = CRUSH_HITSTOP_STEPS;

    if (this.player.lives < 1) {
      this.isOver = true;
      return;
    }

    this.ceilingFrac = this.cycleStartCeilingFrac(this.cycle);
    this.warningArmed = true;
    this.player.dx = this.canvas.width * PLAYER_SPAWN_X_FRAC;
    this.player.direction = 0;
    this.state = 'explore';
    this.resetCycleProgress();
    this.rollCrack();
  }

  step(): boolean {
    if (this.isOver) return false;
    if (this.paused) return true;
    if (this.hitstopStepsLeft > 0) {
      this.hitstopStepsLeft--;
      return true;
    }
    if (this.crushFlashStepsLeft > 0) this.crushFlashStepsLeft--;

    /* The breach beat freezes the countdown and the world */
    if (this.state === 'breach') {
      this.stepBreach();
      return true;
    }

    this.stepCount++;
    this.hud.setScore(this.secondsLeft());
    /* ≤10 s warning: color + pulse (reduced motion keeps color only) */
    this.hud.el('.seconds-value')?.classList.toggle('time-warning', this.secondsLeft() <= 10);

    if (this.state === 'event') {
      /* Hold the ceiling while the ground shakes (rumble fired on entry) */
      if (this.eventShakeStepsLeft > 0) {
        this.eventShakeStepsLeft--;
        return true;
      }

      /* Staged drop into the new level, readable even if drift overshot the start */
      this.eventStepsLeft--;
      const t = 1 - this.eventStepsLeft / STAGED_EVENT_STEPS;
      this.ceilingFrac = this.eventFromFrac + (this.eventTargetFrac - this.eventFromFrac) * t;

      if (this.eventStepsLeft <= 0) {
        this.ceilingFrac = this.eventTargetFrac;
        this.warningArmed = true;
        /* The cycle was already laid out on entry; just resume gameplay */
        this.state = 'explore';
      }
      return true;
    }

    /* Continuous drift: reduced motion never stops it — it's gameplay, not decoration */
    this.ceilingFrac += TUNNEL_LEVELS[this.cycle].driftPerStep;

    if (this.warningArmed && this.inWarningBand()) {
      this.warningArmed = false;
      audio.playSfx(this.rumbleSfx, this.muted);
    }

    if (this.headroomFrac() <= CRUSH_HEADROOM_FRAC) {
      this.handleCrush();
      return true;
    }

    /* Frozen on the charge during the lit fuse: he committed, he stays put */
    if (this.state !== 'armed') this.player?.move();
    this.player?.tickBlink();

    /* Tick the pad one-shots; snap on first arrival at the charge while placed */
    if (this.padArriveSteps > 0) this.padArriveSteps--;
    if (this.padNudgeSteps > 0) this.padNudgeSteps--;
    
    if (this.state === 'placed') {
      const at = this.atCrack();
      if (at && !this.wasAtCrack) this.padArriveSteps = PAD_ARRIVE_STEPS;
      this.wasAtCrack = at;
    } else {
      this.wasAtCrack = false;
    }

    if (this.state === 'armed') {
      this.fuseStepsLeft--;
      if (this.fuseStepsLeft <= 0) this.breach();
    }
    return true;
  }

  /** Advances the breach beat one step at a time (see the BREACH_* constants). */
  private stepBreach(): void {
    this.breachStep++;
    if (this.player) this.player.direction = 0; // falls, no walk cycle
    const isFinal = this.cyclesCleared >= TOTAL_CYCLES;
    if (isFinal) {
      /* Final breach: the run ends the instant the pit opens — no in-tunnel pan
         (it reads as falling into another tunnel). main.ts plays the fall on the
         Abyss screen instead, mirroring the surface→tunnel handoff. */
      if (this.breachStep >= BREACH_BOOM_STEPS) this.isOver = true;
      return;
    }
    if (this.breachStep === BREACH_BOOM_STEPS + 1) {
      /* Collapse cue at 2× so it reads shorter than the final world-boundary
         fall (which plays on the Abyss screen) */
      this.fallingSfx.playbackRate = 2;
      audio.playSfx(this.fallingSfx, this.muted);
    }
    if (this.breachStep >= BREACH_TOTAL_STEPS) {
      /* Landed and the pit sealed overhead; announce the level */
      const banner = this.hud.el('.level-up-banner');
      if (banner) {
        banner.textContent = `Level ${this.cyclesCleared + 1}`;
        restartAnimation(banner, 'show');
      }
      this.state = 'event';
      /* Stage the new level now so it's in place as the chamber arrives */
      this.setupCycle(this.cyclesCleared);
      /* Warn before the drop: a ground shake + grinding rumble fire now */
      this.eventShakeStepsLeft = EVENT_SHAKE_STEPS;
      this.eventStepsLeft = STAGED_EVENT_STEPS;
      this.eventFromFrac = this.ceilingFrac;
      this.eventTargetFrac = Math.max(
        this.cycleStartCeilingFrac(this.cyclesCleared),
        this.ceilingFrac + MIN_EVENT_DROP_FRAC,
      );
      audio.playSfx(this.rumbleSfx, this.muted);
      restartAnimation(this.canvas, 'shake-light');
    }
  }

  private renderFrame(): void {
    this.drawScene();
    /* Frames can still draw after the halt; the latch fires teardown once */
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

  /** Near-crush warning: crouch frame + rumble before the kill line. */
  inWarningBand(): boolean {
    return this.headroomFrac() <= WARNING_HEADROOM_FRAC;
  }

  /** Ground-hole frame for this breach step: opens 0→last (boom), held open
      through the pan, then last→0 (seal). Reduced motion snaps without a tween. */
  private breachHoleFrame(): number {
    const last = this.groundHoleImgs.length - 1;

    if (this.breachStep > BREACH_PAN_END_STEPS) {
      /* Seal beat: cover the hole back over (last→0) */
      if (this.reduceMotion) return 0;
      const t = (this.breachStep - BREACH_PAN_END_STEPS) / BREACH_SEAL_STEPS;
      return Math.max(0, Math.min(last, Math.floor((1 - t) * (last + 1))));
    }

    if (this.breachStep > BREACH_BOOM_STEPS) return last; // held open through the pan
    if (this.reduceMotion) return last;

    const t = this.breachStep / BREACH_BOOM_STEPS;       // blast open (0→last)
    return Math.min(last, Math.floor(t * (last + 1)));
  }

  /** Camera drop during the breach: downward Y offset in px, 0 at the boom up to
      full canvas height on arrival. Reduced motion snaps to the rest frame. */
  private dropOffsetPx(): number {
    if (this.state !== 'breach' || this.breachStep <= BREACH_BOOM_STEPS) return 0;
    
    const t = Math.min(1, (this.breachStep - BREACH_BOOM_STEPS) / BREACH_PAN_STEPS);
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // easeInOutQuad
    
    return (this.reduceMotion ? (t >= 1 ? 1 : 0) : eased) * this.canvas.height;
  }

  private drawScene(): void {
    const { ctx, canvas } = this;
    const size = canvas.width;
    const h = canvas.height;
    const drop = this.dropOffsetPx();
    const floorY = h * FLOOR_FRAC;
    ctx.clearRect(0, 0, size, h);

    if (this.backgroundImg.complete && this.backgroundImg.naturalWidth > 0) {
      ctx.drawImage(this.backgroundImg, 0, -drop, size, h);
      
      if (drop !== 0) {
        /* The next-deeper chamber slides up from below */
        ctx.drawImage(this.backgroundImg, 0, -drop + h, size, h);
      }
    }

    if (this.state === 'breach') {
      this.drawBreachPit(drop);
    } else {
      /* The level's crack, in place from the event onward (staged as the chamber arrives) */
      const crackImg = this.crackImgs[TUNNEL_LEVELS[this.cycle].crackMark];
      
      if (crackImg.complete && crackImg.naturalWidth) {
        const markH = size * CRACK_MARK_HEIGHT_FRAC;
        const markW = markH * (crackImg.naturalWidth / crackImg.naturalHeight);
        ctx.drawImage(crackImg, this.crackXFrac * size - markW / 2, floorY, markW, markH);
      }
    }

    /* Floor bombs waiting to be picked (only present outside the breach) */
    const bombW = 28;
    const bombH = 32;

    /* Footing pad, drawn behind the bombs (see drawLightPad) */
    if (this.state === 'placed') this.drawLightPad(floorY);

    if (this.bombImg.complete && this.bombImg.naturalWidth > 0) {
      for (const x of this.floorBombs) {
        ctx.drawImage(this.bombImg, x * size - bombW / 2, floorY - bombH, bombW, bombH);
      }
      
      /* Bombs stacked on the crack, fanned around its x (none until the player places) */
      if (this.state !== 'breach') {
        for (let i = 0; i < this.placedCount; i++) {
          const stackX = this.crackXFrac * size - bombW / 2
            + (i - (this.placedCount - 1) / 2) * bombW * 0.7;
          ctx.drawImage(this.bombImg, stackX, floorY - bombH, bombW, bombH);
        }
      }
    }

    /* Visual fuse countdown: code-drawn digits over the armed stack */
    if (this.state === 'armed') {
      const fuseSeconds = Math.ceil(this.fuseStepsLeft / 60);
      ctx.font = `${Math.round(size * 0.05)}px monospace`;
      ctx.fillStyle = RUST_ACCENT;
      ctx.textAlign = 'center';
      ctx.fillText(String(fuseSeconds), this.crackXFrac * size, floorY - bombH - 8);
      ctx.textAlign = 'start';
    }

    if (this.player) {
      const crouching = this.state !== 'breach' && this.inWarningBand();
      
      if (crouching) {
        /* Crouch read: vertical squash anchored at the feet */
        ctx.save();
        ctx.translate(0, floorY * 0.2);
        ctx.scale(1, 0.8);
        this.player.drawImage(this.stepCount);
        ctx.restore();
      } else {
        this.player.drawImage(this.stepCount);
      }
    }

    /* Ceiling strip last; it scrolls up with the world during the breach drop */
    if (this.ceilingImg.complete && this.ceilingImg.naturalWidth > 0) {
      const drawH = size * CEILING_ASPECT;
      const drawY = this.ceilingFrac * h - drawH * CEILING_TOOTH_FRAC - drop;
      ctx.drawImage(this.ceilingImg, 0, drawY, size, drawH);
    }

    if (this.crushFlashStepsLeft > 0) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, h);
      ctx.globalAlpha = 1;
    }
  }

  /** The "stand here to light" footing pad on the floor seam: a rust baseline
      with ticks — a spot to stand on, not a box. It breathes, brightens with
      proximity, snaps on arrival, and leans toward him on a stray press. */
  private drawLightPad(floorY: number): void {
    const { ctx, canvas } = this;
    const size = canvas.width;
    const cx = this.crackXFrac * size;
    const dist = Math.abs(this.playerCenterFrac() - this.crackXFrac);
    const prox = 1 - Math.min(1, dist / CRACK_RANGE_FRAC);    // 0 far → 1 on the charge
    const pulse = this.reduceMotion ? 1 : 0.5 + 0.5 * Math.sin(this.stepCount / 8);
    
    let alpha = (this.reduceMotion ? 0.7 : 0.4 + 0.35 * pulse) * (0.4 + 0.6 * prox);
    
    if (this.padArriveSteps > 0) alpha = 1;                   // "locked in" snap
    if (this.padNudgeSteps > 0) alpha = Math.max(alpha, 0.9); // beckon on a stray press
    
    const lean = this.padNudgeSteps > 0 ? this.padNudgeDir * size * 0.02 : 0;

    const padW = size * 0.16;
    const tickW = Math.max(3, size * 0.012);
    const tickH = size * 0.05 * (0.6 + 0.4 * prox) * (this.reduceMotion ? 1 : 0.8 + 0.2 * pulse);
    
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = RUST_ACCENT;
    ctx.fillRect(cx - padW / 2 + lean, floorY - 2, padW, 3);  // footing baseline
    
    for (let i = 0; i < 3; i++) {
      const tx = cx - padW / 2 + lean + (i + 0.5) * (padW / 3);
      ctx.fillRect(tx - tickW / 2, floorY - tickH, tickW, tickH);
    }
    ctx.restore();
  }

  /** The floor pit: blasts open (0→3) and scrolls up with the old chamber as the
      camera drops, then seals overhead in the new chamber (3→0), mouth flipped down. */
  private drawBreachPit(drop: number): void {
    const { ctx, canvas } = this;
    const size = canvas.width;
    const holeImg = this.groundHoleImgs[this.breachHoleFrame()];
    const holeCx = this.crackXFrac * size;
    const holeW = size * 0.4;
    
    if (holeImg?.complete && holeImg.naturalWidth > 0) {
      const holeH = holeW * (holeImg.naturalHeight / holeImg.naturalWidth);
      
      if (this.breachStep > BREACH_PAN_END_STEPS) {
        /* Seals overhead in the new chamber, mouth facing down (flipped) */
        const sealY = size * 0.2;
        ctx.save();
        ctx.translate(holeCx, sealY);
        ctx.scale(1, -1);
        ctx.drawImage(holeImg, -holeW / 2, -holeH / 2, holeW, holeH);
        ctx.restore();
      } else {
        /* Opens in the old floor, scrolling up with the chamber */
        const holeY = canvas.height * FLOOR_FRAC - drop;
        ctx.drawImage(holeImg, holeCx - holeW / 2, holeY - holeH * 0.35, holeW, holeH);
      }
    }
    
    if (this.breachStep <= BREACH_BOOM_STEPS
        && this.booomImg.complete && this.booomImg.naturalWidth > 0) {
      const boomW = size * 0.3;
      const boomY = canvas.height * FLOOR_FRAC - drop;
      ctx.drawImage(this.booomImg, holeCx - boomW / 2, boomY - boomW / 2, boomW, boomW);
    }
  }
}
