import { Player } from './Player';
import { Bomb } from './Bomb';
import { Stalactite } from './Stalactite';
import { RunHost } from './lib/RunHost';
import { Hud } from './lib/Hud';
import { AbyssRenderer } from './AbyssRenderer';
import { SoundEffectBank } from './lib/SoundEffectBank';
import { BOMB_WIDTH, BOMB_HEIGHT } from './lib/geometry';
import {
  makeBreakdown, LEVEL_POINTS, type ScoreBreakdown, type StalactiteSize, type StalactiteBreaks,
} from './lib/score';
import {
  SPRITES, EXPLODE_SFX, MANTRAP_SFX, THUD_SFX, DOOR_SFX, LETSGO_SFX, FALLING_SFX,
} from './assets';

const STEPS_PER_SECOND = 60;
export const ABYSS_LEVEL_THRESHOLDS_S = [0, 18, 36] as const;
export const ABYSS_TIME_BUDGET_S = 72;

/* Per-level pacing. L1 reuses Surface-L1 values (60-frame interval, 1.2 speed);
   each level shortens the bomb interval, speeds bombs up, tightens the stalactite
   spacing, and adds one larger size needing one more hit (cost = level index + 1). */
export const ABYSS_LEVELS = [
  { spawnIntervalFrames: 60, bombSpeed: 1.2, stalactiteGapFrac: 0.55, sizes: ['small'] },
  { spawnIntervalFrames: 42, bombSpeed: 1.5, stalactiteGapFrac: 0.46, sizes: ['small', 'medium'] },
  { spawnIntervalFrames: 30, bombSpeed: 1.8, stalactiteGapFrac: 0.38, sizes: ['small', 'medium', 'large'] },
] as const;

export const ABYSS_L3_RANDOM_COST = false;
/* World geometry as canvas fractions, so nothing jumps when the canvas resizes. */
export const ABYSS_FLOOR_FRAC = 0.82;   // walkable line (ground starts damaged)
export const ABYSS_CEILING_FRAC = 0.30; // ceiling band the stalactites hang from

const CAMERA_SPEED_FRAC = 0.004;        // steady auto-scroll, in canvas-widths/step
const STEER_SPEED_FRAC = 0.006;         // ←→ nudge within the screen window
const PLAYER_MIN_SCREEN_FRAC = 0.18;    // the dodge window the camera pins the lemming inside
const PLAYER_MAX_SCREEN_FRAC = 0.62;
const SPAWN_AHEAD_FRAC = 1.2;           // stalactites seeded just past the right edge
const CULL_BEHIND_FRAC = 1.0;           // drop hazards this far behind the camera

const CARRY_CAP = 3;
const PICKUP_RANGE_FRAC = 0.07;         // "standing on a floor bomb"
const THROW_RANGE_FRAC = 0.09;          // "stalactite overhead" (x-overlap)
const BOMB_SPAWN_AHEAD_FRAC = 0.12;     // bombs drop just ahead of the lemming's path
const BOMB_SPAWN_SPREAD_FRAC = 0.4;

/* Stalactite feedback durations (render-only). */
const SHAKE_STEPS = 12;
const BOOM_STEPS = 14;
const SHATTER_STEPS = 36;
const FALL_SPEED_FRAC = 0.02;

/* Player hitbox insets, shared with the Surface tuning. */
const PLAYER_HITBOX_INSET_X = 8;
const PLAYER_HITBOX_INSET_TOP = 5;
const BOMB_HITBOX_TRIM_RIGHT = 6;

/** The read-only slice of abyss state the renderer draws from each frame. */
export interface AbyssView {
  readonly cameraX: number;
  readonly stalactites: readonly Stalactite[];
  readonly fallingBombs: readonly Bomb[];
  readonly floorBombs: readonly number[]; // world x of bombs resting on the floor
  readonly carried: number;
  readonly breaks: Readonly<StalactiteBreaks>;
  readonly currentLevel: number;
  readonly player: Player | null;
  readonly stepCount: number;
  readonly reduceMotion: boolean;
  readonly entranceWorldX: number;
  readonly entranceOpenFrac: number;
  readonly exitWorldX: number;
  readonly exitOpenFrac: number;
  worldToScreenX(worldX: number): number;
  playerScreenX(): number;
}

export class AbyssGame implements AbyssView {
  player: Player | null = null;
  isOver = false;
  paused = false;
  canvas: HTMLCanvasElement;
  stepCount = 0;
  cameraX = 0;
  playerWorldX = 0;
  currentLevel = 0;
  carried = 0;
  breaks: StalactiteBreaks = { small: 0, medium: 0, large: 0 };
  stalactites: Stalactite[] = [];
  fallingBombs: Bomb[] = [];
  floorBombs: number[] = [];
  /* Door beats are driven by the cold-open/exit state machine (Iteration VI,
     task 4). Defaults here keep the renderer's door path live for core play:
     the entrance reads open, the exit closed until the win beat tweens it. */
  entranceOpenFrac = 1;
  exitOpenFrac = 0;
  readonly reduceMotion: boolean;
  onGameOver: ((breakdown: ScoreBreakdown) => void) | null = null;
  onComplete: ((breakdown: ScoreBreakdown) => void) | null = null;
  abyssLoop: HTMLAudioElement | null = null;
  muted: boolean;
  sfx: SoundEffectBank;
  private outcome: 'death' | 'complete' = 'death';
  private readonly base: ScoreBreakdown;
  private lastBombSpawn = 0;
  private nextStalactiteWorldX = 0;
  private stalactiteSeq = 0;
  private hud: Hud;
  private host: RunHost;
  private renderer: AbyssRenderer;

  constructor(canvas: HTMLCanvasElement, baseBreakdown: ScoreBreakdown) {
    this.canvas = canvas;
    this.base = baseBreakdown;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.muted = localStorage.getItem('audio-muted') === '1';
    this.hud = new Hud();
    this.sfx = new SoundEffectBank({
      pickup: EXPLODE_SFX,
      mantrap: MANTRAP_SFX,
      thud: THUD_SFX,
      door: DOOR_SFX,
      letsgo: LETSGO_SFX,
      falling: FALLING_SFX,
    }, () => this.muted);
    this.renderer = new AbyssRenderer(canvas);
    this.host = new RunHost({
      step: () => this.step(),
      render: () => this.renderer.render(this),
      isOver: () => this.isOver,
      onEnd: () => this.endRun(),
    });
  }

  get runSignal(): AbortSignal {
    return this.host.signal;
  }

  gameOverCallback(callback: (breakdown: ScoreBreakdown) => void): void {
    this.onGameOver = callback;
  }

  completionCallback(callback: (breakdown: ScoreBreakdown) => void): void {
    this.onComplete = callback;
  }

  startGame(): void {
    const w = this.canvas.width;
    this.player = new Player(this.canvas);
    this.player.dy = this.canvas.height * ABYSS_FLOOR_FRAC - this.player.dHeight;
    this.playerWorldX = w * PLAYER_MIN_SCREEN_FRAC;
    this.player.dx = this.playerWorldX;
    this.hud.initLivesIcons(this.player.lives, SPRITES.lemming);
    this.hud.setText('.lives-value', String(this.player.lives));
    this.hud.setScore(0);
    this.hud.setLevel('1');
    this.nextStalactiteWorldX = w * 0.8;
    this.spawnStalactitesAhead();
    this.host.start();
  }

  /** The single action verb: pick up a floor bomb underfoot, else throw a carried
      bomb up at the stalactite overhead. */
  action(): void {
    if (this.paused || this.isOver || !this.player) return;
    const fi = this.floorBombUnderPlayer();
    if (fi >= 0 && this.carried < CARRY_CAP) {
      this.floorBombs.splice(fi, 1);
      this.carried++;
      this.sfx.play('pickup');
      return;
    }
    if (this.carried > 0) {
      const target = this.overheadStalactite();
      if (target) {
        this.carried--;
        this.hitStalactite(target);
      }
    }
  }

  survivedSeconds(): number {
    return Math.min(ABYSS_TIME_BUDGET_S, Math.floor(this.stepCount / STEPS_PER_SECOND));
  }

  worldToScreenX(worldX: number): number {
    return worldX - this.cameraX;
  }

  playerScreenX(): number {
    return this.playerWorldX - this.cameraX;
  }

  get entranceWorldX(): number {
    return this.canvas.width * 0.5;
  }

  /** The exit scrolls into view exactly as the time budget elapses. */
  get exitWorldX(): number {
    const budgetSteps = ABYSS_TIME_BUDGET_S * STEPS_PER_SECOND;
    return CAMERA_SPEED_FRAC * this.canvas.width * budgetSteps + this.canvas.width * PLAYER_MAX_SCREEN_FRAC;
  }

  currentBreakdown(): ScoreBreakdown {
    const abyssLevels = this.outcome === 'complete' ? ABYSS_LEVELS.length : this.currentLevel;
    return makeBreakdown({
      surfaceTime: this.base.surfaceTime,
      tunnelTime: this.base.tunnelTime,
      abyssTime: this.survivedSeconds(),
      stalactites: { ...this.breaks },
      levelsBonus: this.base.levelsBonus + abyssLevels * LEVEL_POINTS,
    });
  }

  step(): boolean {
    if (this.isOver) return false;
    if (this.paused) return true;

    this.stepCount++;
    this.cameraX += CAMERA_SPEED_FRAC * this.canvas.width;
    this.updateLevelByTime();

    if (this.hud.setScore(this.survivedSeconds())) {
      this.hud.setTimeWarning(ABYSS_TIME_BUDGET_S - this.survivedSeconds() <= 10);
    }

    if (this.survivedSeconds() >= ABYSS_TIME_BUDGET_S) {
      this.reachDoor();
      return false;
    }

    this.movePlayer();
    this.player?.tickBlink();
    this.maybeSpawnBomb();
    this.spawnStalactitesAhead();
    this.updateBombs();
    this.tickStalactites();
    this.cull();
    if (this.player) this.hud.displayLives(this.player.lives);
    return !this.isOver;
  }

  private movePlayer(): void {
    if (!this.player) return;
    const w = this.canvas.width;
    this.playerWorldX += this.player.direction * STEER_SPEED_FRAC * w;
    const minW = this.cameraX + w * PLAYER_MIN_SCREEN_FRAC;
    const maxW = this.cameraX + w * PLAYER_MAX_SCREEN_FRAC;
    this.playerWorldX = Math.max(minW, Math.min(this.playerWorldX, maxW));
    this.player.dx = this.playerScreenX();
  }

  private updateLevelByTime(): void {
    const secs = this.survivedSeconds();
    let level = 0;
    for (let i = ABYSS_LEVEL_THRESHOLDS_S.length - 1; i >= 0; i--) {
      if (secs >= ABYSS_LEVEL_THRESHOLDS_S[i]) { level = i; break; }
    }
    if (level !== this.currentLevel) {
      this.currentLevel = level;
      this.hud.setLevel(String(level + 1));
      this.hud.showLevelBanner(`Level ${level + 1}`);
    }
  }

  private maybeSpawnBomb(): void {
    const level = ABYSS_LEVELS[this.currentLevel];
    if (this.stepCount - this.lastBombSpawn < level.spawnIntervalFrames) return;
    const w = this.canvas.width;
    const worldX = this.playerWorldX
      + w * BOMB_SPAWN_AHEAD_FRAC
      + (Math.random() - 0.3) * w * BOMB_SPAWN_SPREAD_FRAC;
    const bomb = new Bomb(this.canvas, worldX, level.bombSpeed);
    bomb.dy = this.canvas.height * ABYSS_CEILING_FRAC;
    this.fallingBombs.push(bomb);
    this.lastBombSpawn = this.stepCount;
  }

  private spawnStalactitesAhead(): void {
    const w = this.canvas.width;
    const limit = this.cameraX + w * SPAWN_AHEAD_FRAC;
    while (this.nextStalactiteWorldX < limit) {
      const level = ABYSS_LEVELS[this.currentLevel];
      this.stalactites.push(new Stalactite(this.nextSize(level.sizes), this.nextStalactiteWorldX));
      this.nextStalactiteWorldX += w * level.stalactiteGapFrac;
      this.stalactiteSeq++;
    }
  }

  /** Fixed S/M/L cycle by default; the L3 1–3 randomization is the off tunable. */
  private nextSize(sizes: readonly StalactiteSize[]): StalactiteSize {
    if (ABYSS_L3_RANDOM_COST && this.currentLevel === 2) {
      return sizes[Math.floor(Math.random() * sizes.length)];
    }
    return sizes[this.stalactiteSeq % sizes.length];
  }

  private updateBombs(): void {
    const floorY = this.canvas.height * ABYSS_FLOOR_FRAC;
    const preLives = this.player?.lives;
    for (let i = this.fallingBombs.length - 1; i >= 0; i--) {
      const bomb = this.fallingBombs[i];
      bomb.move();
      if (bomb.dy + bomb.dHeight >= floorY) {
        this.fallingBombs.splice(i, 1);
        this.floorBombs.push(bomb.dx);
        continue;
      }
      if (this.player && this.bombHitsPlayer(bomb)) {
        this.fallingBombs.splice(i, 1);
        this.player.lives--;
        if (this.player.lives < 1) this.isOver = true;
      }
    }
    if (this.player && preLives !== undefined && this.player.lives < preLives) {
      this.player.triggerBlink(preLives);
    }
  }

  private bombHitsPlayer(bomb: Bomb): boolean {
    if (!this.player) return false;
    const px = this.playerScreenX();
    const playerLeft = px + PLAYER_HITBOX_INSET_X;
    const playerRight = px + this.player.dWidth - PLAYER_HITBOX_INSET_X;
    const playerTop = this.player.dy + PLAYER_HITBOX_INSET_TOP;
    const playerBottom = this.player.dy + this.player.dHeight;
    const bombX = this.worldToScreenX(bomb.dx);
    const bombRight = bombX + BOMB_WIDTH - BOMB_HITBOX_TRIM_RIGHT;
    return playerRight >= bombX && playerLeft <= bombRight
      && playerBottom >= bomb.dy && playerTop <= bomb.dy + BOMB_HEIGHT;
  }

  private floorBombUnderPlayer(): number {
    const range = this.canvas.width * PICKUP_RANGE_FRAC;
    return this.floorBombs.findIndex((x) => Math.abs(x - this.playerWorldX) <= range);
  }

  private overheadStalactite(): Stalactite | null {
    const range = this.canvas.width * THROW_RANGE_FRAC;
    let best: Stalactite | null = null;
    let bestDist = Infinity;
    for (const st of this.stalactites) {
      if (st.destroyed) continue;
      const dist = Math.abs(st.worldX - this.playerWorldX);
      if (dist <= range && dist < bestDist) { best = st; bestDist = dist; }
    }
    return best;
  }

  private hitStalactite(st: Stalactite): void {
    st.shakeStepsLeft = SHAKE_STEPS;
    st.boomStepsLeft = BOOM_STEPS;
    this.sfx.play('mantrap');
    st.hitsRemaining--;
    if (st.hitsRemaining <= 0) {
      st.destroyed = true;
      st.shatterStepsLeft = SHATTER_STEPS;
      this.breaks[st.size]++;
      this.sfx.play('thud');
    }
  }

  private tickStalactites(): void {
    const fallSpeed = this.canvas.height * FALL_SPEED_FRAC;
    for (let i = this.stalactites.length - 1; i >= 0; i--) {
      const st = this.stalactites[i];
      if (st.shakeStepsLeft > 0) st.shakeStepsLeft--;
      if (st.boomStepsLeft > 0) st.boomStepsLeft--;
      if (st.destroyed) {
        st.fallY += fallSpeed;
        st.shatterStepsLeft--;
        if (st.shatterStepsLeft <= 0) this.stalactites.splice(i, 1);
      }
    }
  }

  private cull(): void {
    const behind = this.cameraX - this.canvas.width * CULL_BEHIND_FRAC;
    this.stalactites = this.stalactites.filter((st) => st.destroyed || st.worldX >= behind);
    this.floorBombs = this.floorBombs.filter((x) => x >= behind);
  }

  private reachDoor(): void {
    this.outcome = 'complete';
    this.isOver = true;
  }

  private endRun(): void {
    if (this.abyssLoop) this.abyssLoop.pause();
    const finish = this.outcome === 'complete' ? this.onComplete : this.onGameOver;
    finish?.(this.currentBreakdown());
  }
}
