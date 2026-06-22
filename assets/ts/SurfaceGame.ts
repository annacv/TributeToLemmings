import { Player } from './Player';
import { Bomb } from './Bomb';
import { RunHost } from './lib/RunHost';
import { Hud } from './lib/Hud';
import { restartAnimation } from './lib/fx';
import { BOMB_WIDTH } from './lib/geometry';
import { makeBreakdown, LEVEL_POINTS, type ScoreBreakdown } from './lib/score';
import * as audio from './lib/audio';
import { SoundEffectBank } from './lib/SoundEffectBank';
import { SurfaceRenderer } from './SurfaceRenderer';
import {
  FIRE_SFX, GAME_SONG, SPRITES,
  YIPPEE_SFX, ELECTRIC_SFX, BANG_SFX, TENTON_SFX,
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
const COLLAPSE_COVERAGE = 0.95;
const COLLAPSE_HOLD_MS = 500;
const EARLY_CRACK_MISSES = 4;
const LATE_CRACK_MISSES = 14;
const TUNNEL_STING_WATCHDOG_MS = 4000;

/** The read-only slice of surface state the renderer draws from each frame. Keeps
    the renderer decoupled from gameplay: it reads this view, never mutates it. */
export interface SurfaceView {
  readonly groundErosionActive: boolean;
  readonly player: Player | null;
  readonly count: number;
  readonly bombs: readonly Bomb[];
}

export class SurfaceGame implements SurfaceView {
  player: Player | null;
  bombs: Bomb[];
  isOver: boolean;
  canvas: HTMLCanvasElement;
  onGameOver: ((breakdown: ScoreBreakdown) => void) | null;
  onComplete: ((breakdown: ScoreBreakdown) => void) | null;
  score: number;
  count: number;
  currentLevel: number;
  lastSpawnFrame: number;
  groundErosionActive: boolean;
  erosionCounter: number;
  gameSong: HTMLAudioElement;
  tentonSfx: HTMLAudioElement;
  sfx: SoundEffectBank;
  /* Neutral halt is outcome-neutral; this records which outcome occurred so
     teardown routes to onGameOver (death) or leaves onComplete to the sting. */
  private outcome: 'death' | 'complete';
  private renderer: SurfaceRenderer;
  private hud: Hud;
  private host: RunHost;

  constructor(canvas: HTMLCanvasElement) {
    this.player = null;
    this.bombs = [];
    this.isOver = false;
    this.canvas = canvas;
    this.onGameOver = null;
    this.onComplete = null;
    this.score = 0;
    this.count = 0;
    this.currentLevel = 0;
    this.lastSpawnFrame = 0;
    this.groundErosionActive = false;
    this.erosionCounter = 0;
    this.outcome = 'death';
    this.hud = new Hud();

    this.gameSong = new Audio(GAME_SONG);
    this.tentonSfx = new Audio(TENTON_SFX);
    this.sfx = new SoundEffectBank({
      bombHit: FIRE_SFX,
      levelUp: YIPPEE_SFX,
      electric: ELECTRIC_SFX,
      bang: BANG_SFX,
    }, () => this.gameSong.muted);

    this.renderer = new SurfaceRenderer(canvas);

    this.host = new RunHost({
      step: () => this.step(),
      render: () => this.renderer.render(this),
      isOver: () => this.isOver,
      onEnd: () => this.endRun(),
    });
  }

  startGame(): void {
    this.player = new Player(this.canvas);
    this.initLivesIcons();
    this.updateLevel();
    this.showLevelUpEffect();
    this.gameSong.loop = true;
    audio.safePlay(this.gameSong);

    audio.pauseWhileHidden(this.gameSong, {
      signal: this.host.signal,
      shouldResume: () => !this.isOver,
    });

    this.host.start();
  }

  /** Aborts when the run ends — attach run-scoped listeners with this signal. */
  get runSignal(): AbortSignal {
    return this.host.signal;
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

    return !this.isOver;
  }

  /** Stops the song and, on a death, hands off to game over. A completion routes
      to onComplete through triggerTunnelWorld's sting, not here; run-scoped
      listeners were already dropped by the host's settle. */
  private endRun(): void {
    this.gameSong.pause();
    if (this.outcome === 'death') {
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

  private handleLevelUp(): void {
    this.updateLevel();
    this.showLevelUpEffect();
    this.sfx.play('levelUp');
    if (this.currentLevel === LEVEL_CONFIG.length - 1) {
      this.groundErosionActive = true;
      this.sfx.play('electric');
      this.triggerEarthquake();
    }
  }

  private showLevelUpEffect(): void {
    this.hud.showLevelBanner(`Level ${this.currentLevel + 1}`);
    restartAnimation(document.querySelector('.game-stage'), 'flash-active');
  }

  private triggerEarthquake(): void {
    const frame = document.querySelector('.game-stage') as HTMLElement | null;
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
          if (this.groundErosionActive && this.erodeGround(bomb.dx + bomb.dWidth / 2)) {
            return; // ground collapsed — the world is handing off to the tunnel
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
          this.isOver = true;
        }
      }
    }

    if (this.player && preLives !== undefined && this.player.lives < preLives) {
      this.player.triggerBlink(preLives);
    }
  }

  /** Registers one bomb impact on the eroding ground: stamps a crack (and a hole
      once misses pile up), shakes, and reports whether the ground has now collapsed
      enough to drop the lemming into the tunnel. */
  private erodeGround(impactX: number): boolean {
    this.erosionCounter++;
    this.renderer.stampCrack(impactX, this.erosionCounter <= EARLY_CRACK_MISSES ? 0 : 2);

    if (this.erosionCounter > LATE_CRACK_MISSES) {
      this.renderer.stampHole(impactX);
    }
    this.triggerGroundShake();
    this.sfx.play('bang');

    if (this.renderer.coverage() < COLLAPSE_COVERAGE) return false;

    // force a hole under the lemming so the fall always lines up
    if (this.player) {
      this.renderer.stampHole(this.player.dx + this.player.dWidth / 2, true);
    }
    this.triggerTunnelWorld();
    return true;
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
        this.sfx.play('bombHit');
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

  completionCallback(callback: (breakdown: ScoreBreakdown) => void): void {
    this.onComplete = callback;
  }

  private currentBreakdown(levelsCompleted = this.currentLevel): ScoreBreakdown {
    return makeBreakdown({
      surfaceTime: this.score,
      levelsBonus: levelsCompleted * LEVEL_POINTS,
    });
  }

  private triggerTunnelWorld(): void {
    this.isOver = true;
    this.outcome = 'complete';
    this.gameSong.pause();

    /* The breakdown snapshots at the moment of collapse: surface seconds + all
       surface levels completed, captured before any teardown touches them */
    const breakdown = this.currentBreakdown(this.currentLevel + 1);

    let fired = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;

    const fireCallback = () => {
      if (fired) return;
      fired = true;
      clearTimeout(watchdog);

      if (this.onComplete) {
        this.onComplete(breakdown);
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
