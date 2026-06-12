import { Player } from './Player';
import { Bomb } from './Bomb';
import { GameLoop } from './lib/GameLoop';
import { RunLifecycle } from './lib/RunLifecycle';
import { Hud } from './lib/Hud';
import { restartAnimation } from './lib/fx';
import { BOMB_WIDTH } from './lib/geometry';
import { makeBreakdown, livesBonusPoints, type ScoreBreakdown } from './lib/score';
import * as audio from './lib/audio';
import {
  FIRE_SFX, GAME_SONG, SPRITES,
  YIPPEE_SFX, ELECTRIC_SFX, BANG_SFX, TENTON_SFX,
  CRACK_MARK_SVGS, GROUND_HOLE_SVGS,
} from './assets';


const EXPLOSION_FRAMES = 6; // ~100ms at 60fps — frames to show explosion before removal

const LEVEL_CONFIG = [
  { spawnIntervalFrames: 60,  bombSpeed: 1.2 },  // Level 1 — 1.0 s between bombs
  { spawnIntervalFrames: 36,  bombSpeed: 1.5 },  // Level 2 — 0.6 s ≈ original difficulty
  { spawnIntervalFrames: 24,  bombSpeed: 1.8 },  // Level 3 — 0.4 s, ground erosion activates
] as const;

const LEVEL_THRESHOLDS = [0, 18, 36];
const PLAYER_HITBOX_INSET_X = 8;   // torso/head span x≈15–35 of 50
const PLAYER_HITBOX_INSET_TOP = 5; // hair top starts at y≈5 of 50
const BOMB_HITBOX_TRIM_RIGHT = 6;  // spark occupies x≈22–28 of 28; bombs never mirror
const GROUND_TOP_FRAC = 0.71;
const COVERAGE_COLS = 8;
const COVERAGE_ROWS = 3;
const COLLAPSE_COVERAGE = 0.95;
const COLLAPSE_HOLD_MS = 500;
const EARLY_CRACK_MISSES = 4;
const LATE_CRACK_MISSES = 14;
const TUNNEL_STING_WATCHDOG_MS = 4000;

interface GroundStamp {
  img: HTMLImageElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Game {
  player: Player | null;
  bombs: Bomb[];
  isGameOver: boolean;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  onGameOver: ((breakdown: ScoreBreakdown) => void) | null;
  onTunnelWorld: ((breakdown: ScoreBreakdown) => void) | null;
  score: number;
  count: number;
  currentLevel: number;
  lastSpawnFrame: number;
  groundErosionActive: boolean;
  erosionCounter: number;
  gameSong: HTMLAudioElement;
  bombHitSfx: HTMLAudioElement;
  levelUpSfx: HTMLAudioElement;
  electricSfx: HTMLAudioElement;
  bangSfx: HTMLAudioElement;
  tentonSfx: HTMLAudioElement;
  private isTunnelTransition: boolean;
  private erosionCanvas: HTMLCanvasElement;
  private erosionCtx: CanvasRenderingContext2D;
  private crackImgs: HTMLImageElement[];
  private holeImgs: HTMLImageElement[];
  private crackStamps: GroundStamp[];
  private holeStamps: GroundStamp[];
  private coveredCells: boolean[];
  private hud: Hud;
  private gameLoop: GameLoop;
  private run = new RunLifecycle();

  constructor(canvas: HTMLCanvasElement) {
    this.player = null;
    this.bombs = [];
    this.isGameOver = false;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onGameOver = null;
    this.onTunnelWorld = null;
    this.score = 0;
    this.count = 0;
    this.currentLevel = 0;
    this.lastSpawnFrame = 0;
    this.groundErosionActive = false;
    this.erosionCounter = 0;
    this.isTunnelTransition = false;
    this.crackStamps = [];
    this.holeStamps = [];
    this.coveredCells = new Array(COVERAGE_COLS * COVERAGE_ROWS).fill(false);
    this.hud = new Hud();

    this.gameSong = new Audio(GAME_SONG);
    this.bombHitSfx = new Audio(FIRE_SFX);
    this.levelUpSfx = new Audio(YIPPEE_SFX);
    this.electricSfx = new Audio(ELECTRIC_SFX);
    this.bangSfx = new Audio(BANG_SFX);
    this.tentonSfx = new Audio(TENTON_SFX);

    this.erosionCanvas = document.createElement('canvas');
    this.erosionCanvas.width = canvas.width;
    this.erosionCanvas.height = canvas.height;
    this.erosionCtx = this.erosionCanvas.getContext('2d')!;

    this.gameLoop = new GameLoop({
      step: () => this.step(),
      render: () => this.renderFrame(),
    });

    const loadImgs = (srcs: readonly string[]) => srcs.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
    this.crackImgs = loadImgs(CRACK_MARK_SVGS);
    this.holeImgs = loadImgs(GROUND_HOLE_SVGS);
  }

  startGame(): void {
    this.player = new Player(this.canvas);
    this.initLivesIcons();
    this.updateLevel();
    this.showLevelUpEffect();
    this.gameSong.loop = true;
    audio.safePlay(this.gameSong);

    audio.pauseWhileHidden(this.gameSong, {
      signal: this.run.signal,
      shouldResume: () => !this.isGameOver,
    });

    this.gameLoop.start();
  }

  /** Aborts when the run ends — attach run-scoped listeners with this signal. */
  get runSignal(): AbortSignal {
    return this.run.signal;
  }

  /** One fixed 1/60 s simulation step; returns false when the run has ended. */
  private step(): boolean {
    this.count++;

    if (this.count % 60 === 0) {
      this.score++;
      this.updateScore();
    }

    this.checkLevelUp();

    if (this.count - this.lastSpawnFrame >= LEVEL_CONFIG[this.currentLevel].spawnIntervalFrames) {
      const randomX = Math.random() * (this.canvas.width - BOMB_WIDTH);
      this.bombs.push(new Bomb(this.canvas, randomX, LEVEL_CONFIG[this.currentLevel].bombSpeed));
      this.lastSpawnFrame = this.count;
    }

    this.update();
    this.checkCollisions();
    this.displayLives();

    return !this.isGameOver;
  }

  private renderFrame(): void {
    this.clear();
    this.draw();
    /* Extra frames can draw after the halt — the teardown must fire only once */
    this.run.settle(this.isGameOver, () => this.endRun());
  }

  /** Stops the song and hands off to game over (unless the tunnel transition
      takes it from here); run-scoped listeners were already dropped by settle. */
  private endRun(): void {
    this.gameSong.pause();
    if (!this.isTunnelTransition) {
      this.onGameOver?.(this.currentBreakdown());
    }
  }

  private checkLevelUp(): void {
    const nextLevel = this.currentLevel + 1;
    if (nextLevel < LEVEL_CONFIG.length && this.score >= LEVEL_THRESHOLDS[nextLevel]) {
      this.currentLevel = nextLevel;
      this.lastSpawnFrame = this.count;
      this.handleLevelUp();
    }
  }

  private playSfx(sfx: HTMLAudioElement): void {
    audio.playSfx(sfx, this.gameSong.muted);
  }

  private handleLevelUp(): void {
    this.updateLevel();
    this.showLevelUpEffect();
    this.playSfx(this.levelUpSfx);
    if (this.currentLevel === LEVEL_CONFIG.length - 1) {
      this.groundErosionActive = true;
      this.playSfx(this.electricSfx);
      this.triggerEarthquake();
    }
  }

  private showLevelUpEffect(): void {
    const banner = document.querySelector('.level-up-banner') as HTMLElement | null;
    if (banner) banner.textContent = `Level ${this.currentLevel + 1}`;
    restartAnimation(banner, 'show');
    restartAnimation(document.querySelector('.crt-frame'), 'flash-active');
  }

  private triggerEarthquake(): void {
    const frame = document.querySelector('.crt-frame') as HTMLElement | null;
    if (!frame) return;
    setTimeout(() => restartAnimation(frame, 'shake-quake'), 300);
  }

  update(): void {
    this.player?.move();
    this.player?.tickBlink();

    const preLives = this.player?.lives;

    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      bomb.move();

      if (!bomb.isExploding) {
        if (bomb.dy > this.canvas.height) {
          this.bombs.splice(i, 1);

          if (this.groundErosionActive) {
            this.erosionCounter++;
            const impactX = bomb.dx + bomb.dWidth / 2;
            this.stampCrack(impactX, this.erosionCounter <= EARLY_CRACK_MISSES ? 0 : 2);
            
            if (this.erosionCounter > LATE_CRACK_MISSES) {
              this.stampHole(impactX);
            }
            this.drawGroundErosion();
            this.triggerGroundShake();
            this.playSfx(this.bangSfx);

            if (this.groundCoverage() >= COLLAPSE_COVERAGE) {
              // force a hole under the lemming so the fall always lines up
              if (this.player) {
                this.stampHole(this.player.dx + this.player.dWidth / 2, true);
                this.drawGroundErosion();
              }
              this.triggerTunnelWorld();
              return;
            }
          }
        }
        continue;
      }

      bomb.explosionFramesLeft--;
      if (bomb.explosionFramesLeft > 0) continue;

      this.bombs.splice(i, 1);
      if (this.player) {
        this.player.lives--;
        if (this.player.lives < 1) {
          this.isGameOver = true;
        }
      }
    }

    if (this.player && preLives !== undefined && this.player.lives < preLives) {
      this.player.triggerBlink(preLives);
    }
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(): void {
    if (this.groundErosionActive) {
      this.ctx.drawImage(this.erosionCanvas, 0, 0);
    }
    this.player?.drawImage(this.count);
    this.bombs.forEach((bomb) => bomb.drawImage());
  }

  private drawGroundErosion(): void {
    this.erosionCtx.clearRect(0, 0, this.erosionCanvas.width, this.erosionCanvas.height);
    this.drawStamps(this.holeStamps);
    this.drawStamps(this.crackStamps);
  }

  /** Aspect ratio (w/h) from the image's intrinsic size, so resized assets keep their shape. */
  private static imgAspect(img: HTMLImageElement, fallback: number): number {
    return img.naturalWidth > 0 && img.naturalHeight > 0
      ? img.naturalWidth / img.naturalHeight
      : fallback;
  }

  /** Stamps a crack mark centered under the impact point, alternating between the
   *  two variants of the given pair (offset 0 → marks 1/2, offset 2 → marks 3/4). */
  private stampCrack(impactX: number, variantOffset: number): void {
    const img = this.crackImgs[variantOffset + (this.crackStamps.length % 2)];
    /* An asset-list edit can leave this slot empty; a missing variant must not
       take the whole run down via imgAspect on undefined */
    if (!img) return;
    const h = this.canvas.height * (0.16 + Math.random() * 0.08);
    const w = h * Game.imgAspect(img, 1 / 3);
    const bandTop = this.canvas.height * GROUND_TOP_FRAC;
    const x = Math.min(Math.max(impactX - w / 2, 0), this.canvas.width - w);
    const y = bandTop + Math.random() * Math.max(0, this.canvas.height - bandTop - h);
    this.crackStamps.push({ img, x, y, w, h });
  }

  /** Stamps a hole (alternating star-burst and ragged-void variants) and tracks ground coverage.
   *  `bottomAligned` pins the stamp to the canvas bottom (under the player's feet) instead of a random band y. */
  private stampHole(impactX: number, bottomAligned = false): void {
    const img = this.holeImgs[this.holeStamps.length % this.holeImgs.length];
    const w = this.canvas.width * (0.25 + Math.random() * 0.08);
    const h = w / Game.imgAspect(img, 1 / 0.6);
    const bandTop = this.canvas.height * GROUND_TOP_FRAC;
    const x = Math.min(Math.max(impactX - w / 2, 0), this.canvas.width - w);
    const y = bottomAligned
      ? this.canvas.height - h
      : bandTop + Math.random() * Math.max(0, this.canvas.height - bandTop - h);
    this.holeStamps.push({ img, x, y, w, h });
    this.markCovered(x, y, w, h);
  }

  /** Marks every coverage-grid cell the given stamp rect touches. */
  private markCovered(x: number, y: number, w: number, h: number): void {
    const bandTop = this.canvas.height * GROUND_TOP_FRAC;
    const cellW = this.canvas.width / COVERAGE_COLS;
    const cellH = (this.canvas.height - bandTop) / COVERAGE_ROWS;
    const c0 = Math.max(0, Math.floor(x / cellW));
    const c1 = Math.min(COVERAGE_COLS - 1, Math.floor((x + w) / cellW));
    const r0 = Math.max(0, Math.floor((y - bandTop) / cellH));
    const r1 = Math.min(COVERAGE_ROWS - 1, Math.floor((y - bandTop + h) / cellH));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        this.coveredCells[r * COVERAGE_COLS + c] = true;
      }
    }
  }

  /** Fraction of the ground band currently covered by hole stamps. */
  private groundCoverage(): number {
    let covered = 0;
    for (const cell of this.coveredCells) if (cell) covered++;
    return covered / this.coveredCells.length;
  }

  private drawStamps(stamps: GroundStamp[]): void {
    for (const stamp of stamps) {
      if (stamp.img.complete) {
        this.erosionCtx.drawImage(stamp.img, stamp.x, stamp.y, stamp.w, stamp.h);
      }
    }
  }

  /** Brief, subtle shake on the canvas itself for each individual ground hit. */
  private triggerGroundShake(): void {
    restartAnimation(this.canvas, 'shake-light');
  }

  checkCollisions(): void {
    if (!this.player) return;

    const player = this.player;
    const playerLeft = player.dx + PLAYER_HITBOX_INSET_X;
    const playerRight = player.dx + player.dWidth - PLAYER_HITBOX_INSET_X;
    const playerTop = player.dy + PLAYER_HITBOX_INSET_TOP;
    const playerBottom = player.dy + player.dHeight;

    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      if (bomb.isExploding) continue;

      const bombRight = bomb.dx + bomb.dWidth - BOMB_HITBOX_TRIM_RIGHT;
      const rightLeft = playerRight >= bomb.dx;
      const leftRight = playerLeft <= bombRight;
      const bottomTop = playerBottom >= bomb.dy;
      const topBottom = playerTop <= bomb.dy + bomb.dHeight;

      if (rightLeft && leftRight && bottomTop && topBottom) {
        bomb.image.src = SPRITES.booom;
        bomb.isExploding = true;
        bomb.explosionFramesLeft = EXPLOSION_FRAMES;
        this.playSfx(this.bombHitSfx);
      }
    }
  }

  updateScore(): void {
    this.hud.setScore(this.score);
  }

  updateLevel(): void {
    this.hud.setLevel(String(this.currentLevel + 1));
  }

  initLivesIcons(): void {
    if (!this.player) return;
    this.hud.initLivesIcons(this.player.lives, SPRITES.lemming);
  }

  displayLives(): void {
    if (!this.player) return;
    this.hud.displayLives(this.player.lives);
  }

  gameOverCallback(callback: (breakdown: ScoreBreakdown) => void): void {
    this.onGameOver = callback;
  }

  tunnelWorldCallback(callback: (breakdown: ScoreBreakdown) => void): void {
    this.onTunnelWorld = callback;
  }

  /** Snapshot of the run as a breakdown: surface seconds plus the
      lives-to-points conversion applied at every screen transition. */
  private currentBreakdown(): ScoreBreakdown {
    return makeBreakdown({
      surface: this.score,
      livesBonus: livesBonusPoints(this.player?.lives ?? 0),
    });
  }

  private triggerTunnelWorld(): void {
    this.isGameOver = true;
    this.isTunnelTransition = true;
    this.gameSong.pause();

    /* The breakdown snapshots at the moment of collapse: lives convert to
       points here, at the screen transition, before any teardown touches them */
    const breakdown = this.currentBreakdown();
    let fired = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const fireCallback = () => {
      if (fired) return;
      fired = true;
      clearTimeout(watchdog);
      if (this.onTunnelWorld) {
        this.onTunnelWorld(breakdown);
      } else {
        this.onGameOver?.(breakdown);
      }
    };

    if (this.gameSong.muted) {
      /* No sting hold when muted: a brief pause lets the final stamped frame
         (the hole under the lemming) land before the cut */
      watchdog = setTimeout(fireCallback, COLLAPSE_HOLD_MS);
      return;
    }

    /* Avoids stranding the player on a frozen canvas if any missing 'ended' (play() rejection, decode error,
    stalled playback) */
    this.tentonSfx.addEventListener('ended', fireCallback, { once: true });
    this.tentonSfx.addEventListener('error', fireCallback, { once: true });
    watchdog = setTimeout(fireCallback, TUNNEL_STING_WATCHDOG_MS);
    const playAttempt: Promise<void> | undefined = this.tentonSfx.play();
    playAttempt?.catch(fireCallback);
  }
}
