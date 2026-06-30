import { loadImages } from '../../lib/images';
import { CRACK_MARK_SVGS, GROUND_HOLE_SVGS } from '../../assets';
import type { SurfaceView } from './SurfaceGame';

/* Ground-band geometry, baked to the surface artwork. */
const GROUND_TOP_FRAC = 0.71;
const COVERAGE_COLS = 8;
const COVERAGE_ROWS = 3;

interface GroundStamp {
  img: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Aspect ratio (w/h) from the image's intrinsic size, so resized assets keep their shape. */
function imgAspect(img: HTMLImageElement, fallback: number): number {
  return img.naturalWidth > 0 && img.naturalHeight > 0
    ? img.naturalWidth / img.naturalHeight
    : fallback;
}

/* Draws the surface chamber each frame from a read-only SurfaceView, and owns the
   ground-erosion layer: bomb-impact crack/hole stamps accumulate on an offscreen
   canvas, and `coverage()` reports how eroded the ground is so the game can decide
   when it collapses. Gameplay state stays in SurfaceGame and is never mutated here. */
export class SurfaceRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly erosionCanvas: HTMLCanvasElement;
  private readonly erosionCtx: CanvasRenderingContext2D;
  private readonly crackImgs: HTMLImageElement[];
  private readonly holeImgs: HTMLImageElement[];
  private crackStamps: GroundStamp[] = [];
  private holeStamps: GroundStamp[] = [];
  private coveredCells: boolean[] = new Array(COVERAGE_COLS * COVERAGE_ROWS).fill(false);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.erosionCanvas = document.createElement('canvas');
    this.erosionCanvas.width = canvas.width;
    this.erosionCanvas.height = canvas.height;
    this.erosionCtx = this.erosionCanvas.getContext('2d')!;
    this.crackImgs = loadImages(CRACK_MARK_SVGS);
    this.holeImgs = loadImages(GROUND_HOLE_SVGS);
  }

  render(view: SurfaceView): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (view.groundErosionActive) this.ctx.drawImage(this.erosionCanvas, 0, 0);
    view.player?.drawImage(view.count);
    view.bombs.forEach((bomb) => bomb.drawImage());
  }

  /** Stamps a crack mark centered under the impact point, alternating between the
   *  two variants of the given pair (offset 0 → marks 1/2, offset 2 → marks 3/4). */
  stampCrack(impactX: number, variantOffset: number): void {
    const img = this.crackImgs[variantOffset + (this.crackStamps.length % 2)];
    /* An asset-list edit can leave this slot empty; a missing variant must not
       take the whole run down via imgAspect on undefined */
    if (!img) return;
    const height = this.canvas.height * (0.16 + Math.random() * 0.08);
    const width = height * imgAspect(img, 1 / 3);
    const bandTop = this.canvas.height * GROUND_TOP_FRAC;
    const x = Math.min(Math.max(impactX - width / 2, 0), this.canvas.width - width);
    const y = bandTop + Math.random() * Math.max(0, this.canvas.height - bandTop - height);
    this.crackStamps.push({ img, x, y, width, height });
    this.redrawErosion();
  }

  /** Stamps a hole (cycling the variants) and tracks ground coverage. `bottomAligned`
   *  pins the stamp to the canvas bottom (under the player's feet) instead of a random band y. */
  stampHole(impactX: number, bottomAligned = false): void {
    const img = this.holeImgs[this.holeStamps.length % this.holeImgs.length];
    const width = this.canvas.width * (0.25 + Math.random() * 0.08);
    const height = width / imgAspect(img, 1 / 0.6);
    const bandTop = this.canvas.height * GROUND_TOP_FRAC;
    const x = Math.min(Math.max(impactX - width / 2, 0), this.canvas.width - width);
    const y = bottomAligned
      ? this.canvas.height - height
      : bandTop + Math.random() * Math.max(0, this.canvas.height - bandTop - height);
    this.holeStamps.push({ img, x, y, width, height });
    this.markCovered(x, y, width, height);
    this.redrawErosion();
  }

  /** Fraction of the ground band currently covered by hole stamps. */
  coverage(): number {
    return this.coveredCells.filter(Boolean).length / this.coveredCells.length;
  }

  /** Marks every coverage-grid cell the given stamp rect touches. */
  private markCovered(x: number, y: number, width: number, height: number): void {
    const bandTop = this.canvas.height * GROUND_TOP_FRAC;
    const cellW = this.canvas.width / COVERAGE_COLS;
    const cellH = (this.canvas.height - bandTop) / COVERAGE_ROWS;
    const c0 = Math.max(0, Math.floor(x / cellW));
    const c1 = Math.min(COVERAGE_COLS - 1, Math.floor((x + width) / cellW));
    const r0 = Math.max(0, Math.floor((y - bandTop) / cellH));
    const r1 = Math.min(COVERAGE_ROWS - 1, Math.floor((y - bandTop + height) / cellH));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        this.coveredCells[r * COVERAGE_COLS + c] = true;
      }
    }
  }

  /** Re-blits the offscreen erosion layer (holes behind cracks) after a stamp lands. */
  private redrawErosion(): void {
    this.erosionCtx.clearRect(0, 0, this.erosionCanvas.width, this.erosionCanvas.height);
    this.drawStamps(this.holeStamps);
    this.drawStamps(this.crackStamps);
  }

  private drawStamps(stamps: GroundStamp[]): void {
    for (const stamp of stamps) {
      if (stamp.img.complete) {
        this.erosionCtx.drawImage(stamp.img, stamp.x, stamp.y, stamp.width, stamp.height);
      }
    }
  }
}
