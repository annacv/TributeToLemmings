import { BOMB_WIDTH, BOMB_HEIGHT } from './lib/geometry';
import { loadImage, loadImages } from './lib/images';
import { Stalactite } from './Stalactite';
import {
  ABYSS_FLOOR_FRAC, ABYSS_CEILING_FRAC, type AbyssView,
} from './AbyssGame';
import {
  SPRITES, STALACTITE_SVGS, STALACTITE_CRACK_SVGS,
  ABYSS_CEILING_SVG, ABYSS_BACKGROUND_SVG,
  ABYSS_DOOR_ENTRANCE_SVG, ABYSS_DOOR_ENTRANCE_OPEN_SVG, ABYSS_DOOR_EXIT_SVG,
} from './assets';

const SIZE_INDEX = { small: 0, medium: 1, large: 2 } as const;
const STALACTITE_HEIGHT_FRAC = { small: 0.16, medium: 0.22, large: 0.30 } as const;
const SHAKE_AMP_FRAC = 0.01;
const HINT_BOMB_SIZE = 18;
const ENTRANCE_OPENS_AT_STEP = 60; // hold the closed hatch for ~1s, then swap to the open art

function ready(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0;
}

export class AbyssRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly backgroundImg: HTMLImageElement;
  private readonly ceilingImg: HTMLImageElement;
  private readonly stalactiteImgs: HTMLImageElement[];
  private readonly crackImgs: HTMLImageElement[];
  private readonly bombImg: HTMLImageElement;
  private readonly booomImg: HTMLImageElement;
  private readonly entranceClosedImg: HTMLImageElement;
  private readonly entranceOpenImg: HTMLImageElement;
  private readonly exitImg: HTMLImageElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.backgroundImg = loadImage(ABYSS_BACKGROUND_SVG);
    this.ceilingImg = loadImage(ABYSS_CEILING_SVG);
    this.stalactiteImgs = loadImages(STALACTITE_SVGS);
    this.crackImgs = loadImages(STALACTITE_CRACK_SVGS);
    this.bombImg = loadImage(SPRITES.bomb);
    this.booomImg = loadImage(SPRITES.booom);
    this.entranceClosedImg = loadImage(ABYSS_DOOR_ENTRANCE_SVG);
    this.entranceOpenImg = loadImage(ABYSS_DOOR_ENTRANCE_OPEN_SVG);
    this.exitImg = loadImage(ABYSS_DOOR_EXIT_SVG);
  }

  render(view: AbyssView): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const floorY = h * ABYSS_FLOOR_FRAC;
    const ceilingY = h * ABYSS_CEILING_FRAC;
    ctx.clearRect(0, 0, w, h);

    this.drawCorridor(view, floorY, ceilingY);
    const entranceImg = view.stepCount < ENTRANCE_OPENS_AT_STEP ? this.entranceClosedImg : this.entranceOpenImg;
    this.drawDoor(entranceImg, view.worldToScreenX(view.entranceWorldX), 0, view.entranceOpenFrac, true);
    this.drawDoor(this.exitImg, view.worldToScreenX(view.exitWorldX), floorY, view.exitOpenFrac, false);

    for (const x of view.floorBombs) {
      const sx = view.worldToScreenX(x);
      if (sx < -BOMB_WIDTH || sx > w + BOMB_WIDTH) continue;
      if (ready(this.bombImg)) ctx.drawImage(this.bombImg, sx - BOMB_WIDTH / 2, floorY - BOMB_HEIGHT, BOMB_WIDTH, BOMB_HEIGHT);
    }

    for (const st of view.stalactites) this.drawStalactite(view, st, ceilingY);

    for (const bomb of view.fallingBombs) {
      const sx = view.worldToScreenX(bomb.dx);
      if (sx < -BOMB_WIDTH || sx > w + BOMB_WIDTH) continue;
      if (ready(this.bombImg)) ctx.drawImage(this.bombImg, sx - BOMB_WIDTH / 2, bomb.dy, BOMB_WIDTH, BOMB_HEIGHT);
    }

    if (view.player) view.player.drawImage(view.stepCount);

    this.drawHudHint(view, floorY);
  }

  /** Scrolling damaged-ground corridor. Prefer the painted panorama drawn as a
      parallax backdrop (slower than the foreground so one 6:1 image spans the whole
      run without tiling or stretching); fall back to the procedural corridor until
      the image loads. The painted ceiling/floor already match the renderer fractions. */
  private drawCorridor(view: AbyssView, floorY: number, ceilingY: number): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0b0706';
    ctx.fillRect(0, 0, w, h);

    if (ready(this.backgroundImg)) {
      this.drawBackdrop(view);
      return;
    }

    if (ready(this.ceilingImg)) {
      const tileH = ceilingY + h * 0.06;
      const tileW = tileH * (this.ceilingImg.naturalWidth / this.ceilingImg.naturalHeight);
      let x = -((view.cameraX % tileW) + tileW) % tileW;
      for (; x < w; x += tileW) ctx.drawImage(this.ceilingImg, x, 0, tileW, tileH);
    } else {
      ctx.fillStyle = '#2a0e06';
      ctx.fillRect(0, 0, w, ceilingY);
    }

    // damaged floor band
    ctx.fillStyle = '#3a1208';
    ctx.fillRect(0, floorY, w, h - floorY);
    ctx.fillStyle = '#5a1006';
    ctx.fillRect(0, floorY, w, 4);
    // scrolling erosion notches
    ctx.fillStyle = '#1a0a06';
    const notchGap = w * 0.18;
    let nx = -((view.cameraX % notchGap) + notchGap) % notchGap;
    for (; nx < w; nx += notchGap) ctx.fillRect(nx, floorY, w * 0.05, 6);
  }

  /** Painted panorama as a parallax backdrop. Scale to canvas height, then pick a
      parallax factor so the single image still covers the right edge at the end of
      the run — no tiling (would repeat the framing rocks) and no horizontal stretch. */
  private drawBackdrop(view: AbyssView): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const bgW = h * (this.backgroundImg.naturalWidth / this.backgroundImg.naturalHeight);
    // Slowest scroll that keeps the backdrop covering [0, w] through the whole run.
    const parallax = Math.max(0, Math.min(0.6, (bgW - w) / Math.max(view.exitWorldX, 1)));
    ctx.drawImage(this.backgroundImg, -view.cameraX * parallax, 0, bgW, h);
  }

  private drawStalactite(view: AbyssView, st: Stalactite, ceilingY: number): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const sx = view.worldToScreenX(st.worldX);
    const img = this.stalactiteImgs[SIZE_INDEX[st.size]];
    const drawH = canvas.height * STALACTITE_HEIGHT_FRAC[st.size];
    const aspect = ready(img) ? img.naturalWidth / img.naturalHeight : 0.42;
    const drawW = drawH * aspect;
    if (sx < -drawW || sx > w + drawW) return; // cull off-screen

    const shake = st.shakeStepsLeft > 0 && !view.reduceMotion
      ? Math.sin(st.shakeStepsLeft) * w * SHAKE_AMP_FRAC : 0;
    const drawX = sx - drawW / 2 + shake;
    const drawY = ceilingY - drawH * 0.08 + st.fallY;

    if (ready(img)) ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // crack overlay indexed by hits taken (guarded so a destroyed one never indexes [-1])
    if (!st.destroyed && st.hitsTaken > 0) {
      const crack = this.crackImgs[st.hitsTaken - 1];
      if (crack && ready(crack)) ctx.drawImage(crack, drawX, drawY, drawW, drawH);
    }

    // impact flash at the tip
    if (st.boomStepsLeft > 0 && ready(this.booomImg)) {
      const boom = drawW * 1.1;
      ctx.drawImage(this.booomImg, drawX + drawW / 2 - boom / 2, drawY + drawH - boom / 2, boom, boom);
    }
  }

  /** One openFrac path for both doors: draw the prop, then cover the doorway with
      a shrinking dark leaf so openFrac 0 reads closed, 1 reads fully open. */
  private drawDoor(img: HTMLImageElement, screenX: number, anchorY: number, openFrac: number, fromCeiling: boolean): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    if (!ready(img)) return;
    const drawW = w * 0.3;
    const drawH = drawW * (img.naturalHeight / img.naturalWidth);
    const drawX = screenX - drawW / 2;
    if (drawX < -drawW || drawX > w + drawW) return;
    const drawY = fromCeiling ? anchorY : anchorY - drawH;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    const closed = 1 - Math.max(0, Math.min(1, openFrac));
    if (closed > 0) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#060404';
      ctx.fillRect(drawX + drawW * 0.2, drawY + drawH * 0.15, drawW * 0.6, drawH * 0.7 * closed);
      ctx.restore();
    }
  }

  /** Bottom-left hint: carried bombs as repeated bomb sprites + per-size breaks. */
  private drawHudHint(view: AbyssView, floorY: number): void {
    const { ctx } = this;
    const pad = 10;
    const y = floorY + (this.canvas.height - floorY) / 2;

    for (let i = 0; i < view.carried; i++) {
      const x = pad + i * (HINT_BOMB_SIZE + 4);
      if (ready(this.bombImg)) {
        ctx.drawImage(this.bombImg, x, y - HINT_BOMB_SIZE, HINT_BOMB_SIZE * (BOMB_WIDTH / BOMB_HEIGHT), HINT_BOMB_SIZE);
      }
    }

    ctx.save();
    ctx.font = `${Math.round(this.canvas.width * 0.035)}px monospace`;
    ctx.fillStyle = '#f0a848';
    ctx.textAlign = 'start';
    const { small, medium, large } = view.breaks;
    ctx.fillText(`S${small} M${medium} L${large}`, pad, y + HINT_BOMB_SIZE);
    ctx.restore();
  }
}
