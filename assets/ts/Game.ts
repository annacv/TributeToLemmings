import { Player } from './Player';
import { Bomb } from './Bomb';
import {
  FIRE_SFX, GAME_SONG, SPRITES,
  YIPPEE_SFX, ELECTRIC_SFX, BANG_SFX, TENTON_SFX,
  GROUND_EROSION_SVGS,
} from './assets';

/** ~100ms at 60fps — frames to show explosion before removal */
const EXPLOSION_FRAMES = 6;

const LEVEL_CONFIG = [
  { spawnIntervalFrames: 60,  bombSpeed: 1.2 },  // Level 1 — 1.0 s between bombs
  { spawnIntervalFrames: 36,  bombSpeed: 1.5 },  // Level 2 — 0.6 s ≈ original difficulty
  { spawnIntervalFrames: 24,  bombSpeed: 1.8 },  // Level 3 — 0.4 s, ground erosion activates
] as const;

const LEVEL_THRESHOLDS = [0, 18, 36]; // score (seconds) at which each level starts
const EROSION_CAPACITY = 15;

const PROGRESSIVE_HOLES = [
  { atCount: 5,  xFrac: 0.18, yFrac: 0.78, rxFrac: 0.11,  ryFrac: 0.085 },
  { atCount: 7,  xFrac: 0.82, yFrac: 0.78, rxFrac: 0.12,  ryFrac: 0.09 },
  { atCount: 9,  xFrac: 0.30, yFrac: 0.88, rxFrac: 0.13,  ryFrac: 0.095 },
  { atCount: 11, xFrac: 0.70, yFrac: 0.88, rxFrac: 0.135, ryFrac: 0.10 },
  { atCount: 13, xFrac: 0.50, yFrac: 0.74, rxFrac: 0.14,  ryFrac: 0.105 },
] as const;

interface CrackMark {
  x: number;
  y: number;
  angle: number;
  length: number;
  jitter: number;
}

interface HoleMark {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export class Game {
  player: Player | null;
  bombs: Bomb[];
  isGameOver: boolean;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  onGameOver: ((score: number) => void) | null;
  onTunnelWorld: ((score: number) => void) | null;
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
  private erosionImgs: HTMLImageElement[];
  private crackMarks: CrackMark[];
  private holeMarks: HoleMark[];

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
    this.crackMarks = [];
    this.holeMarks = [];

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

    this.erosionImgs = (GROUND_EROSION_SVGS as readonly string[]).map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
  }

  startGame(): void {
    this.player = new Player(this.canvas);
    this.initLivesIcons();
    this.updateLevel();
    this.showLevelUpEffect();
    this.gameSong.loop = true;
    this.gameSong.play();

    const loop = () => {
      this.count++;

      if (this.count % 60 === 0) {
        this.score++;
      }

      this.checkLevelUp();

      if (this.count - this.lastSpawnFrame >= LEVEL_CONFIG[this.currentLevel].spawnIntervalFrames) {
        const randomX = Math.random() * (this.canvas.width - 28);
        this.bombs.push(new Bomb(this.canvas, randomX, LEVEL_CONFIG[this.currentLevel].bombSpeed));
        this.lastSpawnFrame = this.count;
      }

      this.update();
      this.clear();
      this.draw();
      this.checkCollisions();
      this.displayLives();
      this.updateScore();

      if (!this.isGameOver) {
        requestAnimationFrame(loop);
      } else {
        this.gameSong.pause();
        if (!this.isTunnelTransition) {
          this.onGameOver?.(this.score);
        }
      }
    };

    loop();
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
    if (!this.gameSong.muted) {
      this.levelUpSfx.currentTime = 0;
      this.levelUpSfx.play();
    }
    if (this.currentLevel === LEVEL_CONFIG.length - 1) {
      this.groundErosionActive = true;
      this.drawGroundErosion();
      if (!this.gameSong.muted) {
        this.electricSfx.play();
      }
      this.triggerEarthquake();
    }
  }

  private showLevelUpEffect(): void {
    const banner = document.querySelector('.level-up-banner') as HTMLElement | null;
    if (banner) {
      banner.textContent = `Level ${this.currentLevel + 1}`;
      banner.classList.remove('show');
      void banner.offsetWidth; // restart animation if still running
      banner.classList.add('show');
    }

    const frame = document.querySelector('.crt-frame') as HTMLElement | null;
    if (frame) {
      frame.classList.remove('flash-active');
      void frame.offsetWidth; // restart animation if still running
      frame.classList.add('flash-active');
    }
  }

  private triggerEarthquake(): void {
    const frame = document.querySelector('.crt-frame') as HTMLElement | null;
    if (!frame) return;
    setTimeout(() => {
      frame.classList.remove('shake-quake');
      void frame.offsetWidth; // restart animation if still running
      frame.classList.add('shake-quake');
    }, 300);
  }

  update(): void {
    this.player?.move();

    const preLives = this.player?.lives;

    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      bomb.move();

      if (!bomb.isExploding) {
        if (bomb.dy > this.canvas.height) {
          this.bombs.splice(i, 1);
          if (this.groundErosionActive) {
            this.erosionCounter++;
            this.addCrackMark(bomb.dx + bomb.dWidth / 2);
            this.addProgressiveHole();
            this.drawGroundErosion();
            this.triggerGroundShake();
            if (!this.gameSong.muted) {
              this.bangSfx.currentTime = 0;
              this.bangSfx.play();
            }
            if (this.erosionCounter >= EROSION_CAPACITY) {
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
    let imgIndex = 0;
    if (this.erosionCounter >= 15) imgIndex = 3;
    else if (this.erosionCounter >= 10) imgIndex = 2;
    else if (this.erosionCounter >= 5) imgIndex = 1;

    const img = this.erosionImgs[imgIndex];
    const render = () => {
      this.erosionCtx.clearRect(0, 0, this.erosionCanvas.width, this.erosionCanvas.height);
      this.erosionCtx.drawImage(img, 0, 0, this.erosionCanvas.width, this.erosionCanvas.height);
      this.drawCrackMarks();
      this.drawHoleMarks();
    };

    if (img.complete) {
      render();
    } else {
      img.addEventListener('load', render, { once: true });
    }
  }

  /** Adds one jagged crack mark centered under where a bomb just hit the ground. */
  private addCrackMark(x: number): void {
    const groundTop = this.canvas.height * 0.71;
    const groundBottom = this.canvas.height * 0.85;
    this.crackMarks.push({
      x,
      y: groundTop + Math.random() * (groundBottom - groundTop),
      angle: (Math.random() - 0.5) * 1.4,
      length: this.canvas.height * (0.10 + Math.random() * 0.08),
      jitter: (Math.random() - 0.5) * this.canvas.width * 0.03,
    });
  }

  /** Punches an extra big hole through the ground at scripted erosion counts. */
  private addProgressiveHole(): void {
    const hole = PROGRESSIVE_HOLES.find((h) => h.atCount === this.erosionCounter);
    if (!hole) return;
    this.holeMarks.push({
      cx: this.canvas.width * hole.xFrac,
      cy: this.canvas.height * hole.yFrac,
      rx: this.canvas.width * hole.rxFrac,
      ry: this.canvas.height * hole.ryFrac,
    });
  }

  private drawCrackMarks(): void {
    const ctx = this.erosionCtx;
    ctx.strokeStyle = '#070503';
    ctx.lineWidth = 4;
    for (const crack of this.crackMarks) {
      const dx = Math.sin(crack.angle) * crack.length;
      const dy = Math.cos(crack.angle) * crack.length;
      ctx.beginPath();
      ctx.moveTo(crack.x, crack.y);
      ctx.lineTo(crack.x + dx * 0.5 + crack.jitter, crack.y + dy * 0.5);
      ctx.lineTo(crack.x + dx, crack.y + dy);
      ctx.stroke();
    }
  }

  private drawHoleMarks(): void {
    const ctx = this.erosionCtx;
    for (const hole of this.holeMarks) {
      ctx.fillStyle = '#020208';
      ctx.beginPath();
      ctx.ellipse(hole.cx, hole.cy, hole.rx, hole.ry, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(1, 1, 5, 0.7)';
      ctx.beginPath();
      ctx.ellipse(hole.cx, hole.cy, hole.rx * 0.65, hole.ry * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Brief, subtle shake on the canvas itself for each individual ground hit. */
  private triggerGroundShake(): void {
    this.canvas.classList.remove('shake-light');
    void this.canvas.offsetWidth; // restart animation if still running
    this.canvas.classList.add('shake-light');
  }

  checkCollisions(): void {
    if (!this.player) return;

    const player = this.player;

    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      if (bomb.isExploding) continue;

      const rightLeft = player.dx + player.dWidth >= bomb.dx;
      const leftRight = player.dx <= bomb.dx + bomb.dWidth;
      const bottomTop = player.dy + player.dHeight >= bomb.dy;
      const topBottom = player.dy <= bomb.dy + bomb.dHeight;

      if (rightLeft && leftRight && bottomTop && topBottom) {
        bomb.image.src = SPRITES.booom;
        bomb.isExploding = true;
        bomb.explosionFramesLeft = EXPLOSION_FRAMES;
        if (!this.gameSong.muted) {
          this.bombHitSfx.currentTime = 0;
          this.bombHitSfx.play();
        }
      }
    }
  }

  updateScore(): void {
    const scoreDisplay = document.querySelector('.seconds-value');
    if (scoreDisplay) scoreDisplay.textContent = String(this.score);
  }

  updateLevel(): void {
    const levelDisplay = document.querySelector('.level-value');
    if (levelDisplay) levelDisplay.textContent = String(this.currentLevel + 1);
  }

  initLivesIcons(): void {
    const container = document.querySelector('.lives-icons');
    if (!container || !this.player) return;
    container.innerHTML = '';
    for (let i = 0; i < this.player.lives; i++) {
      const img = document.createElement('img');
      img.src = SPRITES.lemming;
      img.className = 'life-icon';
      img.alt = '';
      container.appendChild(img);
    }
  }

  displayLives(): void {
    const livesDisplay = document.querySelector('.lives-value');
    if (livesDisplay && this.player) livesDisplay.textContent = String(this.player.lives);

    const container = document.querySelector('.lives-icons');
    if (!container || !this.player) return;
    const activeIcons = container.querySelectorAll('.life-icon:not(.life-losing)');
    const excess = activeIcons.length - Math.max(0, this.player.lives);
    for (let i = 0; i < excess; i++) {
      const icon = activeIcons[activeIcons.length - 1 - i] as HTMLElement;
      icon.classList.add('life-losing');
      icon.addEventListener('animationend', () => icon.remove(), { once: true });
    }
  }

  gameOverCallback(callback: (score: number) => void): void {
    this.onGameOver = callback;
  }

  tunnelWorldCallback(callback: (score: number) => void): void {
    this.onTunnelWorld = callback;
  }

  private triggerTunnelWorld(): void {
    this.isGameOver = true;
    this.isTunnelTransition = true;
    this.gameSong.pause();

    const fireCallback = () => {
      if (this.onTunnelWorld) {
        this.onTunnelWorld(this.score);
      } else {
        this.onGameOver?.(this.score);
      }
    };

    if (!this.gameSong.muted) {
      this.tentonSfx.play();
      this.tentonSfx.addEventListener('ended', fireCallback, { once: true });
    } else {
      fireCallback();
    }
  }
}
