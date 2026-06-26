import { BOMB_WIDTH, BOMB_HEIGHT } from './lib/geometry';
import { loadImage, loadImages, ready } from './lib/images';
import { drawFootingPad } from './lib/footingPad';
import { Stalactite } from './Stalactite';
import {
  ABYSS_FLOOR_FRAC, ABYSS_CEILING_FRAC, THROW_RANGE_FRAC, THROW_FLIGHT_STEPS, type AbyssView,
} from './AbyssGame';
import {
  SPRITES, STALACTITE_SVGS, STALACTITE_CRACK_SVGS,
  ABYSS_BACKGROUND_SVG,
  ABYSS_DOOR_ENTRANCE_SVG, ABYSS_DOOR_ENTRANCE_OPEN_SVG, ABYSS_DOOR_EXIT_SVG,
} from './assets';

const SIZE_INDEX = { small: 0, medium: 1, large: 2 } as const;
const STALACTITE_HEIGHT_FRAC = { small: 0.16, medium: 0.22, large: 0.30 } as const;
const STALACTITE_GLOW_COLOR = '#FFD27A';
const SHAKE_AMP_FRAC = 0.01;
const BACKDROP_PARALLAX = 0.3; // backdrop pans at this fraction of the camera for depth

export class AbyssRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly backgroundImg: HTMLImageElement;
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
    const width = canvas.width;
    const height = canvas.height;
    const floorY = height * ABYSS_FLOOR_FRAC;
    const ceilingY = height * ABYSS_CEILING_FRAC;
    ctx.clearRect(0, 0, width, height);

    this.drawCorridor(view);
    this.drawThrowHints(view, floorY);
    // Entrance: a clean two-state swap — the closed art shows until DOOR.WAV fires the
    // open, then the open art replaces it (no synthetic cover; the two assets carry the state).
    const entranceImg = view.entranceOpenFrac > 0 ? this.entranceOpenImg : this.entranceClosedImg;
    this.drawDoor(entranceImg, view.worldToScreenX(view.entranceWorldX), 0, 0, true);
    // Exit: a single prop revealed by a dark cover that shrinks as it opens.
    this.drawDoor(this.exitImg, view.worldToScreenX(view.exitWorldX), floorY, 1 - view.exitOpenFrac, false);

    for (const worldX of view.floorBombs) {
      const screenX = view.worldToScreenX(worldX);
      if (screenX < -BOMB_WIDTH || screenX > width + BOMB_WIDTH) continue;
      if (ready(this.bombImg)) ctx.drawImage(this.bombImg, screenX - BOMB_WIDTH / 2, floorY - BOMB_HEIGHT, BOMB_WIDTH, BOMB_HEIGHT);
    }

    for (const stalactite of view.stalactites) this.drawStalactite(view, stalactite, ceilingY);

    for (const bomb of view.fallingBombs) {
      const screenX = view.worldToScreenX(bomb.dx);
      if (screenX < -BOMB_WIDTH || screenX > width + BOMB_WIDTH) continue;
      if (ready(this.bombImg)) ctx.drawImage(this.bombImg, screenX - BOMB_WIDTH / 2, bomb.dy, BOMB_WIDTH, BOMB_HEIGHT);
    }

    this.drawThrownBombs(view, ceilingY);

    if (view.player && view.entranceOpenFrac > 0) view.player.drawImage(view.stepCount);
  }

  private drawThrowHints(view: AbyssView, floorY: number): void {
    if (!view.player) return;
    const { ctx, canvas } = this;
    const width = canvas.width;
    const range = width * THROW_RANGE_FRAC;
    const playerWorldX = view.playerScreenX() + view.cameraX;
    const pulse = view.reduceMotion ? 1 : 0.5 + 0.5 * Math.sin(view.stepCount / 8);
    for (const stalactite of view.stalactites) {
      if (stalactite.destroyed) continue;
      const dist = Math.abs(stalactite.worldX - playerWorldX);
      if (dist > range) continue;
      const proximity = 1 - dist / range; // 0 at the edge of range → 1 right under it
      const screenX = view.worldToScreenX(stalactite.worldX);
      const alpha = Math.min(1, (0.25 + 0.6 * proximity) * (view.reduceMotion ? 1 : 0.7 + 0.3 * pulse));
      drawFootingPad(
        ctx, screenX, floorY, width * 0.13,
        width * 0.045 * (0.6 + 0.4 * proximity), STALACTITE_GLOW_COLOR, alpha,
      );
    }
  }

  private drawThrownBombs(view: AbyssView, ceilingY: number): void {
    if (!view.player || !ready(this.bombImg)) return;
    const { ctx, canvas } = this;
    const originX = view.playerScreenX() + view.player.dWidth / 2;
    const originY = view.player.dy;
    for (const thrown of view.thrownBombs) {
      const progress = 1 - thrown.stepsLeft / THROW_FLIGHT_STEPS;
      const stalactiteHeight = canvas.height * STALACTITE_HEIGHT_FRAC[thrown.target.size];
      const tipX = view.worldToScreenX(thrown.target.worldX);
      const tipY = ceilingY - stalactiteHeight * 0.08 + thrown.target.fallY + stalactiteHeight;
      const bombX = originX + (tipX - originX) * progress;
      const bombY = originY + (tipY - originY) * progress;
      ctx.drawImage(this.bombImg, bombX - BOMB_WIDTH / 2, bombY - BOMB_HEIGHT / 2, BOMB_WIDTH, BOMB_HEIGHT);
    }
  }

  private drawCorridor(view: AbyssView): void {
    const { ctx, canvas } = this;

    ctx.fillStyle = '#0b0706';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (ready(this.backgroundImg)) this.drawBackdrop(view);
  }

  /** Painted panorama as a parallax backdrop. Scale to canvas height, then pick a
      parallax factor so the single image still covers the right edge at the end of
      the run — no tiling (would repeat the framing rocks) and no horizontal stretch. */
  private drawBackdrop(view: AbyssView): void {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;
    const backgroundWidth = height * (this.backgroundImg.naturalWidth / this.backgroundImg.naturalHeight);
    // Pan with the camera for depth, clamped so the single image's right edge never
    // pulls past the canvas (no tiling, no gap) once the camera has run far enough.
    const shift = Math.min(Math.max(0, view.cameraX) * BACKDROP_PARALLAX, Math.max(0, backgroundWidth - width));
    ctx.drawImage(this.backgroundImg, -shift, 0, backgroundWidth, height);
  }

  private drawStalactite(view: AbyssView, stalactite: Stalactite, ceilingY: number): void {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const screenX = view.worldToScreenX(stalactite.worldX);
    const img = this.stalactiteImgs[SIZE_INDEX[stalactite.size]];
    const drawHeight = canvas.height * STALACTITE_HEIGHT_FRAC[stalactite.size];
    const aspect = ready(img) ? img.naturalWidth / img.naturalHeight : 0.42;
    const drawWidth = drawHeight * aspect;
    if (screenX < -drawWidth || screenX > width + drawWidth) return; // cull off-screen

    const shake = stalactite.shakeStepsLeft > 0 && !view.reduceMotion
      ? Math.sin(stalactite.shakeStepsLeft) * width * SHAKE_AMP_FRAC : 0;
    const drawX = screenX - drawWidth / 2 + shake;
    const drawY = ceilingY - drawHeight * 0.08 + stalactite.fallY;

    if (ready(img)) {
      if (!stalactite.destroyed) {
        const pulse = view.reduceMotion ? 0.6 : 0.5 + 0.5 * Math.sin(view.stepCount * 0.12);
        ctx.save();
        ctx.shadowColor = STALACTITE_GLOW_COLOR;
        ctx.shadowBlur = 6 + pulse * 12;
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
      } else {
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      }
    }

    // crack overlay indexed by hits taken (guarded so a destroyed one never indexes [-1])
    if (!stalactite.destroyed && stalactite.hitsTaken > 0) {
      const crack = this.crackImgs[stalactite.hitsTaken - 1];
      if (crack && ready(crack)) ctx.drawImage(crack, drawX, drawY, drawWidth, drawHeight);
    }

    // impact flash at the tip
    if (stalactite.boomStepsLeft > 0 && ready(this.booomImg)) {
      const boom = drawWidth * 1.1;
      ctx.drawImage(this.booomImg, drawX + drawWidth / 2 - boom / 2, drawY + drawHeight - boom / 2, boom, boom);
    }
  }

  /** Draw a door prop, optionally covering its doorway with a dark leaf
      (coverFrac 1 = fully covered, 0 = uncovered) — used by the exit reveal. */
  private drawDoor(img: HTMLImageElement, screenX: number, anchorY: number, coverFrac: number, fromCeiling: boolean): void {
    const { ctx, canvas } = this;
    const width = canvas.width;
    if (!ready(img)) return;
    const drawWidth = width * 0.3;
    const drawHeight = drawWidth * (img.naturalHeight / img.naturalWidth);
    const drawX = screenX - drawWidth / 2;
    if (drawX < -drawWidth || drawX > width + drawWidth) return;
    const drawY = fromCeiling ? anchorY : anchorY - drawHeight;
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    const closed = Math.max(0, Math.min(1, coverFrac));
    if (closed > 0) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#060404';
      ctx.fillRect(drawX + drawWidth * 0.2, drawY + drawHeight * 0.15, drawWidth * 0.6, drawHeight * 0.7 * closed);
      ctx.restore();
    }
  }

}
