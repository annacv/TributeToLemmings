const BLINK_TOTAL_FRAMES = 30;
const HAIR_PERIOD = 48;
const SVG_SIZE = 142;

let _bodyPath: Path2D | null = null;
let _hairPath: Path2D | null = null;
let _hairExtras: Path2D[] | null = null;
let _clothesPath: Path2D | null = null;

function getPaths(): { body: Path2D; hair: Path2D; hairExtras: Path2D[]; clothes: Path2D } {
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

    // Three extra hair pixel blocks forming a staircase up the left side of the
    // hair. They appear/disappear progressively to simulate hair movement.
    // Block 1 — left of the lower hair step
    const e1 = new Path2D(); e1.rect(14, 28.7167969, 14, 13.9277343);
    // Blocks 2+3 — appear together: row 2 above block 1, and row 1 further left
    const e23 = new Path2D();
    e23.rect(14, 14.328125, 14, 14.3886282);  // block 2 (row 2)
    e23.rect(0, 28.7167969, 14, 13.9277343);  // block 3 (row 1, further left)
    _hairExtras = [e1, e23];

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
  return { body: _bodyPath, hair: _hairPath!, hairExtras: _hairExtras!, clothes: _clothesPath! };
}

// Returns 0-2: how many extra hair blocks to draw this frame.
// Produces a wave: 0→1→2→1→0→… over HAIR_PERIOD frames.
function getHairLevel(frameCount: number): number {
  const phase = frameCount % HAIR_PERIOD;
  if (phase < 8) return 0;
  if (phase < 16) return 1;
  if (phase < 40) return 2;
  return 1;
}

export function drawLemmingShape(ctx: CanvasRenderingContext2D, bodyColor: string, hairLevel: number): void {
  const { body, hair, hairExtras, clothes } = getPaths();
  ctx.fillStyle = bodyColor;
  ctx.fill(body);
  ctx.fillStyle = '#03B605';
  ctx.fill(hair);
  for (let i = 0; i < Math.min(hairLevel, hairExtras.length); i++) ctx.fill(hairExtras[i]);
  ctx.fillStyle = '#5B60FC';
  ctx.fill(clothes);
  ctx.fillStyle = bodyColor;
  ctx.fillRect(29, 127, 28, 15);
  ctx.fillRect(85, 127, 28, 15);
}

export function drawLemmingMascot(ctx: CanvasRenderingContext2D, canvasSize: number, frameCount: number): void {
  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.save();
  ctx.scale(canvasSize / SVG_SIZE, canvasSize / SVG_SIZE);
  drawLemmingShape(ctx, '#FFFFFF', getHairLevel(frameCount));
  ctx.restore();
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
  blinkColor: string;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dWidth = 50;
    this.dHeight = 50;
    this.dx = 40;
    this.dy = canvas.height - this.dHeight - 38;
    this.lives = 3;
    this.direction = 0;
    this.speed = 1;
    this.blinkFramesLeft = 0;
    this.blinkColor = '#FFFFFF';
  }

  move(): void {
    this.dx = this.dx + this.direction * this.speed;
    const maxX = this.canvas.width - this.dWidth - 1;
    const next = this.dx + this.direction * this.speed;

    if (next <= 0 || next >= maxX) {
      this.direction = -this.direction;
    }
    this.dx = Math.max(0, Math.min(this.dx, maxX));
  }

  triggerBlink(livesSnapshot?: number): void {
    this.blinkColor = getBodyColor(livesSnapshot ?? this.lives);
    this.blinkFramesLeft = BLINK_TOTAL_FRAMES;
  }

  drawImage(frameCount: number): void {
    if (this.blinkFramesLeft > 0) {
      this.blinkFramesLeft--;
      if (this.blinkFramesLeft % 2 === 0) return;
    }

    const { ctx, dx, dy, dWidth, direction } = this;
    const scale = dWidth / SVG_SIZE;
    const bodyColor = this.blinkFramesLeft > 0 ? this.blinkColor : getBodyColor(this.lives);

    ctx.save();
    if (direction < 0) {
      ctx.translate(dx + dWidth, dy);
      ctx.scale(-scale, scale);
    } else {
      ctx.translate(dx, dy);
      ctx.scale(scale, scale);
    }
    drawLemmingShape(ctx, bodyColor, getHairLevel(frameCount));
    ctx.restore();
  }

  setDirection(newDirection: number): void {
    this.direction = newDirection;
  }
}
