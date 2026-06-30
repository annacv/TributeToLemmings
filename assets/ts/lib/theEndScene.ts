import { drawLemmingShape } from '../Player';
import { ready } from './images';

/* The End finale scene math + draw, kept pure (no timers, no audio) so the beat
   geometry is unit-testable. The screen function (main.ts) owns the clock, audio,
   input and routing; it calls theEndFrameAt() each rAF and hands the frame here. */

export const THE_END_SKY = '#00C8FF'; // matches background-theend.svg's sky, filled above the scrolled scene
const BALLOON_ASPECT = 423 / 272;     // balloon.svg viewBox h/w
const LEMMING_GRID = 142;             // drawLemmingShape coordinate space

export interface TheEndCfg {
  size: number;        // canvas px (square)
  groundY: number;     // px — lemming feet / balloon basket at rest
  balloonX: number;    // px — balloon centre x
  balloonW: number;    // px — balloon draw width
  lemmingSize: number; // px — on-ground lemming size
  walkStartX: number;  // px — lemming start (left)
  walkEndX: number;    // px — lemming at the balloon (left)
}

export interface TheEndDurations { walkMs: number; boardMs: number; ascendMs: number; }

export type TheEndPhase = 'walk' | 'prompt' | 'board' | 'ascend';

export interface TheEndFrame {
  phase: TheEndPhase;
  groundScrollY: number; // px the scene has scrolled DOWN (camera rising)
  balloonX: number; balloonY: number; balloonW: number;
  lemmingX: number; lemmingY: number; lemmingSize: number;
  hairLevel: number;
  boarded: boolean;
}

/* Pure: where everything sits at `elapsed` ms, given when (if) lift-off fired.
   liftOffElapsed === null means the lemming is still walking / waiting at the balloon. */
export function theEndFrameAt(
  elapsed: number,
  liftOffElapsed: number | null,
  dur: TheEndDurations,
  cfg: TheEndCfg,
): TheEndFrame {
  const balloonH = cfg.balloonW * BALLOON_ASPECT;
  const restBalloonY = cfg.groundY - balloonH;
  const restLemmingY = cfg.groundY - cfg.lemmingSize;
  const basketY = (balloonTop: number): number => balloonTop + balloonH * 0.74;

  const base = { balloonX: cfg.balloonX, balloonW: cfg.balloonW };

  if (liftOffElapsed === null) {
    const wt = Math.min(elapsed / dur.walkMs, 1);
    return {
      ...base,
      phase: wt < 1 ? 'walk' : 'prompt',
      groundScrollY: 0,
      balloonY: restBalloonY,
      lemmingX: cfg.walkStartX + (cfg.walkEndX - cfg.walkStartX) * wt,
      lemmingY: restLemmingY,
      lemmingSize: cfg.lemmingSize,
      hairLevel: 0,
      boarded: false,
    };
  }

  const local = elapsed - liftOffElapsed;
  const walkProgressAtLiftOff = Math.min(liftOffElapsed / dur.walkMs, 1);
  const boardStartX = cfg.walkStartX + (cfg.walkEndX - cfg.walkStartX) * walkProgressAtLiftOff;

  if (local < dur.boardMs) {
    const bt = Math.max(local, 0) / dur.boardMs;
    const lemmingSize = cfg.lemmingSize * (1 - 0.4 * bt);
    const targetX = cfg.balloonX - lemmingSize / 2;
    return {
      ...base,
      phase: 'board',
      groundScrollY: 0,
      balloonY: restBalloonY,
      lemmingX: boardStartX + (targetX - boardStartX) * bt,
      lemmingY: restLemmingY + (basketY(restBalloonY) - restLemmingY) * bt,
      lemmingSize,
      hairLevel: 0,
      boarded: true,
    };
  }

  const at = Math.min((local - dur.boardMs) / dur.ascendMs, 1);
  const eased = at < 0.5 ? 2 * at * at : 1 - (-2 * at + 2) ** 2 / 2; // easeInOutQuad
  const balloonY = restBalloonY + (cfg.size * 0.18 - restBalloonY) * eased;
  const lemmingSize = cfg.lemmingSize * 0.6;
  return {
    ...base,
    phase: 'ascend',
    groundScrollY: eased * cfg.size * 1.25,
    balloonY,
    lemmingX: cfg.balloonX - lemmingSize / 2,
    lemmingY: basketY(balloonY),
    lemmingSize,
    hairLevel: 4,
    boarded: true,
  };
}

/* Pure draw: sky fill (covers the area the scene scrolls away from), the scene
   panel scrolled down, the balloon prop, then the lemming via the shared shape. */
export function drawTheEndScene(
  ctx: CanvasRenderingContext2D,
  size: number,
  f: TheEndFrame,
  sceneImg: HTMLImageElement,
  balloonImg: HTMLImageElement,
): void {
  ctx.fillStyle = THE_END_SKY;
  ctx.fillRect(0, 0, size, size);
  if (ready(sceneImg)) ctx.drawImage(sceneImg, 0, f.groundScrollY, size, size);
  if (ready(balloonImg)) {
    const h = f.balloonW * (balloonImg.naturalHeight / balloonImg.naturalWidth);
    ctx.drawImage(balloonImg, f.balloonX - f.balloonW / 2, f.balloonY, f.balloonW, h);
  }
  ctx.save();
  ctx.translate(f.lemmingX, f.lemmingY);
  ctx.scale(f.lemmingSize / LEMMING_GRID, f.lemmingSize / LEMMING_GRID);
  drawLemmingShape(ctx, '#FFFFFF', f.hairLevel);
  ctx.restore();
}
