import { Player } from './Player';
import { Bomb } from './Bomb';
import { GAME_SONG, SPRITES } from './assets';

/** ~100ms at 60fps — frames to show explosion before removal */
const EXPLOSION_FRAMES = 6;

export class Game {
  player: Player | null;
  bombs: Bomb[];
  isGameOver: boolean;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  onGameOver: ((score: number) => void) | null;
  score: number;
  count: number;
  gameSong: HTMLAudioElement;

  constructor(canvas: HTMLCanvasElement) {
    this.player = null;
    this.bombs = [];
    this.isGameOver = false;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onGameOver = null;
    this.score = 0;
    this.count = 0;
    this.gameSong = new Audio(GAME_SONG);
  }

  startGame(): void {
    this.player = new Player(this.canvas);
    this.initLivesIcons();

    const loop = () => {
      if (Math.random() > 0.97) {
        const randomX = Math.random() * (this.canvas.width - 28);
        this.bombs.push(new Bomb(this.canvas, randomX));
      }
      this.count++;

      if (this.count % 60 === 0) {
        this.score++;
      }

      this.update();
      this.clear();
      this.draw();
      this.checkCollisions();
      this.displayLives();
      this.updateScore();
      this.saveScore(this.score);

      if (!this.isGameOver) {
        this.gameSong.play();
        requestAnimationFrame(loop);
      } else {
        this.onGameOver?.(this.score);
        this.gameSong.pause();
      }
    };

    loop();
  }

  update(): void {
    this.player?.move();

    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      bomb.move();

      if (!bomb.isExploding) continue;

      bomb.explosionFramesLeft--;
      if (bomb.explosionFramesLeft > 0) continue;

      this.bombs.splice(i, 1);
      if (this.player) {
        this.player.lives--;
        this.player.triggerBlink();
        if (this.player.lives < 1) {
          this.isGameOver = true;
        }
      }
    }
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(): void {
    this.player?.drawImage(this.count);
    this.bombs.forEach((bomb) => bomb.drawImage());
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
      }
    }
  }

  updateScore(): void {
    const scoreDisplay = document.querySelector('.seconds-value');
    if (scoreDisplay) scoreDisplay.innerHTML = String(this.score);
  }

  saveScore(score: number): void {
    localStorage.setItem('score-value', String(score));
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
    if (livesDisplay && this.player) livesDisplay.innerHTML = String(this.player.lives);

    const container = document.querySelector('.lives-icons');
    if (!container || !this.player) return;
    const activeIcons = container.querySelectorAll('.life-icon:not(.life-losing)');
    const excess = activeIcons.length - this.player.lives;
    for (let i = 0; i < excess; i++) {
      const icon = activeIcons[activeIcons.length - 1 - i] as HTMLElement;
      icon.classList.add('life-losing');
      icon.addEventListener('animationend', () => icon.remove(), { once: true });
    }
  }

  gameOverCallback(callback: (score: number) => void): void {
    this.onGameOver = callback;
  }
}
