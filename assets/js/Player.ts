import { SPRITES } from './assets';

export class Player {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  image: HTMLImageElement;
  dx: number;
  dy: number;
  dWidth: number;
  dHeight: number;
  lives: number;
  direction: number;
  speed: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.image = new Image();
    this.image.src = SPRITES.lemming;
    this.dWidth = 50;
    this.dHeight = 50;
    this.dx = 40;
    this.dy = canvas.height - this.dHeight - 38;
    this.lives = 3;
    this.direction = 0;
    this.speed = 1;
  }

  move(): void {
    this.dx = this.dx + this.direction * this.speed;
    if (
      this.dx + this.direction * this.speed === 0 ||
      this.dx + this.direction * this.speed >= this.canvas.width - this.dWidth - 1
    ) {
      this.direction = this.direction / -1;
    }
  }

  drawImage(): void {
    this.ctx.drawImage(this.image, this.dx, this.dy, this.dWidth, this.dHeight);
    if (this.lives === 2) {
      this.image.src = SPRITES.lemming2Lives;
    } else if (this.lives === 1 || this.lives === 0) {
      this.image.src = SPRITES.lemming1Life;
    } else {
      this.image.src = SPRITES.lemming;
    }
  }

  setDirection(newDirection: number): void {
    this.direction = newDirection;
  }
}
