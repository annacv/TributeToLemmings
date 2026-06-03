import { SPRITES } from './assets';

export class Bomb {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  image: HTMLImageElement;
  dx: number;
  dy: number;
  dWidth: number;
  dHeight: number;
  direction: number;
  speed: number;
  isExploding: boolean;
  explosionFramesLeft: number;

  constructor(canvas: HTMLCanvasElement, randomX: number) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.image = new Image();
    this.image.src = SPRITES.bomb;
    this.dx = randomX;
    this.dy = -45;
    this.dWidth = 28;
    this.dHeight = 32;
    this.direction = 1;
    this.speed = 1.5;
    this.isExploding = false;
    this.explosionFramesLeft = 0;
  }

  move(): void {
    this.dy = this.dy + this.direction * this.speed;
  }

  drawImage(): void {
    this.ctx.drawImage(this.image, this.dx, this.dy, this.dWidth, this.dHeight);
  }
}
