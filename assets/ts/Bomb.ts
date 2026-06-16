import { SPRITES } from './assets';
import { BOMB_WIDTH, BOMB_HEIGHT } from './lib/geometry';

export class Bomb {
  ctx: CanvasRenderingContext2D;
  image: HTMLImageElement;
  dx: number;
  dy: number;
  dWidth: number;
  dHeight: number;
  speed: number;
  isExploding: boolean;
  explosionFramesLeft: number;

  constructor(canvas: HTMLCanvasElement, randomX: number, speed: number = 1.5) {
    this.ctx = canvas.getContext('2d')!;
    this.image = new Image();
    this.image.src = SPRITES.bomb;
    this.dx = randomX;
    this.dy = -45;
    this.dWidth = BOMB_WIDTH;
    this.dHeight = BOMB_HEIGHT;
    this.speed = speed;
    this.isExploding = false;
    this.explosionFramesLeft = 0;
  }

  move(): void {
    this.dy = this.dy + this.speed;
  }

  drawImage(): void {
    this.ctx.drawImage(this.image, this.dx, this.dy, this.dWidth, this.dHeight);
  }
}
