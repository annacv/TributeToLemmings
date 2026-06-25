import { BOMB_WIDTH, BOMB_HEIGHT } from './lib/geometry';
import { loadImage, loadImages, ready } from './lib/images';
import {
  TUNNEL_LEVELS, FLOOR_FRAC, CRACK_RANGE_FRAC,
  BREACH_BOOM_STEPS, BREACH_PAN_STEPS,
  type TunnelView,
} from './TunnelGame';
import {
  SPRITES, CRACK_MARK_SVGS, GROUND_HOLE_SVGS,
  TUNNEL_BACKGROUND_SVG, TUNNEL_CEILING_SVG,
} from './assets';

/* Render-only geometry, baked to the tunnel artwork. */
const CEILING_ASPECT = 800 / 800;     // tunnel-ceiling.svg strip
const CEILING_TOOTH_FRAC = 794 / 800; // deepest tooth: the collision line, never per-tooth
const CRACK_MARK_HEIGHT_FRAC = 0.12;
const RUST_ACCENT = '#A85A1C';

/* Draws the tunnel chamber each frame from a read-only TunnelView. It owns the
   canvas context and the world artwork; gameplay state stays in TunnelGame and is
   never mutated here. The fine alpha/pulse/scale tuning numbers are left inline,
   beside the comments that explain them, rather than hoisted to named constants. */
export class TunnelRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly backgroundImg: HTMLImageElement;
  private readonly ceilingImg: HTMLImageElement;
  private readonly crackImgs: HTMLImageElement[];
  private readonly bombImg: HTMLImageElement;
  private readonly booomImg: HTMLImageElement;
  private readonly groundHoleImgs: HTMLImageElement[];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.backgroundImg = loadImage(TUNNEL_BACKGROUND_SVG);
    this.ceilingImg = loadImage(TUNNEL_CEILING_SVG);
    this.crackImgs = loadImages(CRACK_MARK_SVGS);
    this.bombImg = loadImage(SPRITES.bomb);
    this.booomImg = loadImage(SPRITES.booom);
    this.groundHoleImgs = loadImages(GROUND_HOLE_SVGS);
  }

  render(view: TunnelView): void {
    const { ctx, canvas } = this;
    const size = canvas.width;
    const h = canvas.height;
    const drop = this.dropOffsetPx(view);
    const floorY = h * FLOOR_FRAC;
    ctx.clearRect(0, 0, size, h);

    if (ready(this.backgroundImg)) {
      ctx.drawImage(this.backgroundImg, 0, -drop, size, h);

      if (drop !== 0) {
        /* The next-deeper chamber slides up from below */
        ctx.drawImage(this.backgroundImg, 0, -drop + h, size, h);
      }
    }

    if (view.state === 'breach') {
      this.drawBreachPit(view, drop);
    } else {
      /* The level's crack, in place from the event onward (staged as the chamber arrives) */
      const crackImg = this.crackImgs[TUNNEL_LEVELS[view.cycle].crackMark];

      if (ready(crackImg)) {
        const markH = size * CRACK_MARK_HEIGHT_FRAC;
        const markW = markH * (crackImg.naturalWidth / crackImg.naturalHeight);
        ctx.drawImage(crackImg, view.crackXFrac * size - markW / 2, floorY, markW, markH);
      }
    }

    /* Footing pad, drawn behind the bombs (see drawLightPad) */
    if (view.state === 'placed') this.drawLightPad(view, floorY);

    if (ready(this.bombImg)) {
      for (const x of view.floorBombs) {
        ctx.drawImage(this.bombImg, x * size - BOMB_WIDTH / 2, floorY - BOMB_HEIGHT, BOMB_WIDTH, BOMB_HEIGHT);
      }

      /* Bombs stacked on the crack, fanned around its x (none until the player places) */
      if (view.state !== 'breach') {
        for (let i = 0; i < view.placedCount; i++) {
          const stackX = view.crackXFrac * size - BOMB_WIDTH / 2
            + (i - (view.placedCount - 1) / 2) * BOMB_WIDTH * 0.7;
          ctx.drawImage(this.bombImg, stackX, floorY - BOMB_HEIGHT, BOMB_WIDTH, BOMB_HEIGHT);
        }
      }
    }

    /* Visual fuse countdown: code-drawn digits over the armed stack */
    if (view.state === 'armed') {
      const fuseSeconds = Math.ceil(view.fuseStepsLeft / 60);
      ctx.font = `${Math.round(size * 0.05)}px monospace`;
      ctx.fillStyle = RUST_ACCENT;
      ctx.textAlign = 'center';
      ctx.fillText(String(fuseSeconds), view.crackXFrac * size, floorY - BOMB_HEIGHT - 8);
      ctx.textAlign = 'start';
    }

    if (view.player) {
      const crouching = view.state !== 'breach' && view.inWarningBand();

      if (crouching) {
        /* Crouch read: vertical squash anchored at the feet */
        ctx.save();
        ctx.translate(0, floorY * 0.2);
        ctx.scale(1, 0.8);
        view.player.drawImage(view.stepCount);
        ctx.restore();
      } else {
        view.player.drawImage(view.stepCount);
      }
    }

    /* Ceiling strip last; it scrolls up with the world during the breach drop */
    if (ready(this.ceilingImg)) {
      const drawH = size * CEILING_ASPECT;
      const drawY = view.ceilingFrac * h - drawH * CEILING_TOOTH_FRAC - drop;
      ctx.drawImage(this.ceilingImg, 0, drawY, size, drawH);
    }

    if (view.crushFlash > 0) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, h);
      ctx.globalAlpha = 1;
    }
  }

  /** Camera drop during the breach: downward Y offset in px, 0 at the boom up to
      full canvas height on arrival. Reduced motion snaps to the rest frame. */
  private dropOffsetPx(view: TunnelView): number {
    if (view.state !== 'breach' || view.breachStep <= BREACH_BOOM_STEPS) return 0;

    const t = Math.min(1, (view.breachStep - BREACH_BOOM_STEPS) / BREACH_PAN_STEPS);
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // easeInOutQuad

    /* Reduced motion snaps to the rest frame (full drop only once the pan completes) */
    const snap = t >= 1 ? 1 : 0;
    return (view.reduceMotion ? snap : eased) * this.canvas.height;
  }

  /** Ground-hole frame for this breach step: opens 0→last (boom), then held open
      through the pan as it scrolls up and away. Reduced motion snaps open. */
  private breachHoleFrame(view: TunnelView): number {
    const last = this.groundHoleImgs.length - 1;

    if (view.breachStep > BREACH_BOOM_STEPS) return last; // held open through the pan
    if (view.reduceMotion) return last;

    const t = view.breachStep / BREACH_BOOM_STEPS;       // blast open (0→last)
    return Math.min(last, Math.floor(t * (last + 1)));
  }

  /** The "stand here to light" footing pad on the floor seam: a rust baseline
      with ticks — a spot to stand on, not a box. It breathes, brightens with
      proximity, snaps on arrival, and leans toward him on a stray press. */
  private drawLightPad(view: TunnelView, floorY: number): void {
    const { ctx, canvas } = this;
    const size = canvas.width;
    const cx = view.crackXFrac * size;
    const dist = Math.abs(view.playerCenterFrac() - view.crackXFrac);
    const prox = 1 - Math.min(1, dist / CRACK_RANGE_FRAC);    // 0 far → 1 on the charge
    const pulse = view.reduceMotion ? 1 : 0.5 + 0.5 * Math.sin(view.stepCount / 8);

    let alpha = (view.reduceMotion ? 0.7 : 0.4 + 0.35 * pulse) * (0.4 + 0.6 * prox);

    if (view.padArriveSteps > 0) alpha = 1;                   // "locked in" snap
    if (view.padNudgeSteps > 0) alpha = Math.max(alpha, 0.9); // beckon on a stray press

    const lean = view.padNudgeSteps > 0 ? view.padNudgeDir * size * 0.02 : 0;

    const padW = size * 0.16;
    const tickW = Math.max(3, size * 0.012);
    const tickH = size * 0.05 * (0.6 + 0.4 * prox) * (view.reduceMotion ? 1 : 0.8 + 0.2 * pulse);

    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = RUST_ACCENT;
    ctx.fillRect(cx - padW / 2 + lean, floorY - 2, padW, 3);  // footing baseline

    for (let i = 0; i < 3; i++) {
      const tx = cx - padW / 2 + lean + (i + 0.5) * (padW / 3);
      ctx.fillRect(tx - tickW / 2, floorY - tickH, tickW, tickH);
    }
    ctx.restore();
  }

  /** The floor pit: blasts open (0→3) and scrolls up with the old chamber as the
      camera drops into the new chamber. */
  private drawBreachPit(view: TunnelView, drop: number): void {
    const { ctx, canvas } = this;
    const size = canvas.width;
    const holeImg = this.groundHoleImgs[this.breachHoleFrame(view)];
    const holeCx = view.crackXFrac * size;
    const holeW = size * 0.4;

    if (holeImg && ready(holeImg)) {
      /* Opens in the old floor, scrolling up with the chamber */
      const holeH = holeW * (holeImg.naturalHeight / holeImg.naturalWidth);
      const holeY = canvas.height * FLOOR_FRAC - drop;
      ctx.drawImage(holeImg, holeCx - holeW / 2, holeY - holeH * 0.35, holeW, holeH);
    }

    if (view.breachStep <= BREACH_BOOM_STEPS && ready(this.booomImg)) {
      const boomW = size * 0.3;
      const boomY = canvas.height * FLOOR_FRAC - drop;
      ctx.drawImage(this.booomImg, holeCx - boomW / 2, boomY - boomW / 2, boomW, boomW);
    }
  }
}
