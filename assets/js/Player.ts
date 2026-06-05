const BLINK_TOTAL_FRAMES = 30;
const HAIR_PERIOD = 16;
const HAIR_ON_FRAMES = 8;
const SVG_SIZE = 142;

let _bodyPath: Path2D | null = null;
let _hairPath: Path2D | null = null;
let _hairExtraPath: Path2D | null = null;
let _clothesPath: Path2D | null = null;

function getPaths(): { body: Path2D; hair: Path2D; hairExtra: Path2D; clothes: Path2D } {
  if (!_bodyPath) {
    const body = new Path2D();
    body.moveTo(0, 71.5);
    body.lineTo(142, 70.5);
    body.lineTo(142, 42.6445312);
    body.lineTo(127.707866, 42.6445312);
    body.lineTo(127.707866, 57.0722656);
    body.lineTo(85.0984054, 57.0722656);
    body.lineTo(85.0984054, 42.6445312);
    body.lineTo(99.210943, 42.6445312);
    body.lineTo(99.210943, 26.9863281);
    body.lineTo(56.3109878, 26.9863281);
    body.lineTo(56.3109878, 57.0722656);
    body.lineTo(14.318828, 57.0722656);
    body.lineTo(14.318828, 42.6445312);
    body.lineTo(0, 42.6445312);
    body.closePath();
    _bodyPath = body;

    const hair = new Path2D();
    hair.moveTo(28, 42.6445312);
    hair.lineTo(70.6778509, 42.6445312);
    hair.lineTo(70.6778509, 28.7167969);
    hair.lineTo(99, 28.7167969);
    hair.lineTo(99, 14.328125);
    hair.lineTo(85.0822094, 14.328125);
    hair.lineTo(85.0822094, 0);
    hair.lineTo(56.0671875, 0);
    hair.lineTo(56.0671875, 14.328125);
    hair.lineTo(28, 14.328125);
    hair.closePath();
    _hairPath = hair;

    // Extra hair pixels following the main hair polygon — fills the lower-right
    // step adjacent to the main hair shape, toggled on/off for the hair animation
    const hairExtra = new Path2D();
    hairExtra.rect(70.6778509, 28.7167969, 28.3221491, 13.9277343);
    _hairExtraPath = hairExtra;

    const clothes = new Path2D();
    clothes.moveTo(55.670582, 57);
    clothes.lineTo(85.5890902, 57);
    clothes.lineTo(85.5890902, 98.8308068);
    clothes.lineTo(99, 98.8308068);
    clothes.lineTo(99, 127);
    clothes.lineTo(84.5969096, 127);
    clothes.lineTo(84.5969096, 113.432274);
    clothes.lineTo(56.6627626, 113.432274);
    clothes.lineTo(56.6627626, 127);
    clothes.lineTo(42, 127);
    clothes.lineTo(42, 98.8308068);
    clothes.lineTo(55.670582, 98.8308068);
    clothes.closePath();
    _clothesPath = clothes;
  }
  return { body: _bodyPath, hair: _hairPath!, hairExtra: _hairExtraPath!, clothes: _clothesPath! };
}

function getBodyColor(lives: number): string {
  if (lives >= 3) return '#FFFFFF';
  if (lives === 2) return '#FEBD00';
  return '#C62828';
}

export class Player {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dx: number;
  dy: number;
  dWidth: number;
  dHeight: number;
  lives: number;
  direction: number;
  speed: number;
  blinkFramesLeft: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dWidth = 50;
    this.dHeight = 50;
    this.dx = 40;
    this.dy = canvas.height - this.dHeight - 38;
    this.lives = 3;
    this.direction = 1;
    this.speed = 1;
    this.blinkFramesLeft = 0;
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

  triggerBlink(): void {
    this.blinkFramesLeft = BLINK_TOTAL_FRAMES;
  }

  drawImage(frameCount: number): void {
    if (this.blinkFramesLeft > 0) {
      this.blinkFramesLeft--;
      if (this.blinkFramesLeft % 2 !== 0) return;
    }

    const { ctx, dx, dy, dWidth, direction } = this;
    const scale = dWidth / SVG_SIZE;
    const bodyColor = getBodyColor(this.lives);
    const { body, hair, hairExtra, clothes } = getPaths();

    ctx.save();
    if (direction < 0) {
      ctx.translate(dx + dWidth, dy);
      ctx.scale(-scale, scale);
    } else {
      ctx.translate(dx, dy);
      ctx.scale(scale, scale);
    }

    ctx.fillStyle = bodyColor;
    ctx.fill(body);

    ctx.fillStyle = '#03B605';
    ctx.fill(hair);
    if (frameCount % HAIR_PERIOD < HAIR_ON_FRAMES) {
      ctx.fill(hairExtra);
    }

    ctx.fillStyle = '#5B60FC';
    ctx.fill(clothes);

    ctx.fillStyle = bodyColor;
    ctx.fillRect(29, 127, 28, 15);
    ctx.fillRect(85, 127, 28, 15);

    ctx.restore();
  }

  setDirection(newDirection: number): void {
    this.direction = newDirection;
  }
}
