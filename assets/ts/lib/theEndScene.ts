import { drawLemmingShape } from '../Player';
import { ready } from './images';

export const THE_END_SKY = '#00C8FF'; // matches background-theend.svg's sky, filled above the scrolled scene
const BALLOON_ASPECT = 423 / 272;     // balloon.svg viewBox h/w
const LEMMING_GRID = 142;             // drawLemmingShape coordinate space

const BASKET_OFFSET_FRAC = 0.74;      // basket sits this far down the balloon height
const BOARD_SHRINK_FRAC = 0.4;        // lemming shrinks by this fraction while boarding
const ASCEND_LEMMING_SCALE = 0.6;     // lemming scale during ascent (matches boarded size)
const ASCEND_BALLOON_TOP_FRAC = 0.18; // balloon top rests at this fraction of canvas height at ascent end
const ASCEND_SCROLL_FRAC = 1.25;      // camera scroll distance over the ascent, in canvas heights

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
  durations: TheEndDurations,
  config: TheEndCfg,
): TheEndFrame {
  const balloonH = config.balloonW * BALLOON_ASPECT;
  const restBalloonY = config.groundY - balloonH;
  const restLemmingY = config.groundY - config.lemmingSize;
  const basketY = (balloonTop: number): number => balloonTop + balloonH * BASKET_OFFSET_FRAC;
  const base = { balloonX: config.balloonX, balloonW: config.balloonW };

  if (liftOffElapsed === null) {
    const walkProgress = Math.min(elapsed / durations.walkMs, 1);
    return {
      ...base,
      phase: walkProgress < 1 ? 'walk' : 'prompt',
      groundScrollY: 0,
      balloonY: restBalloonY,
      lemmingX: config.walkStartX + (config.walkEndX - config.walkStartX) * walkProgress,
      lemmingY: restLemmingY,
      lemmingSize: config.lemmingSize,
      hairLevel: 0,
      boarded: false,
    };
  }

  const sinceLiftOff = elapsed - liftOffElapsed;
  const walkProgressAtLiftOff = Math.min(liftOffElapsed / durations.walkMs, 1);
  const boardStartX = config.walkStartX + (config.walkEndX - config.walkStartX) * walkProgressAtLiftOff;

  if (sinceLiftOff < durations.boardMs) {
    const boardProgress = Math.max(sinceLiftOff, 0) / durations.boardMs;
    const lemmingSize = config.lemmingSize * (1 - BOARD_SHRINK_FRAC * boardProgress);
    const targetX = config.balloonX - lemmingSize / 2;
    return {
      ...base,
      phase: 'board',
      groundScrollY: 0,
      balloonY: restBalloonY,
      lemmingX: boardStartX + (targetX - boardStartX) * boardProgress,
      lemmingY: restLemmingY + (basketY(restBalloonY) - restLemmingY) * boardProgress,
      lemmingSize,
      hairLevel: 0,
      boarded: true,
    };
  }

  const ascendProgress = Math.min((sinceLiftOff - durations.boardMs) / durations.ascendMs, 1);
  const eased = ascendProgress < 0.5 ? 2 * ascendProgress * ascendProgress : 1 - (-2 * ascendProgress + 2) ** 2 / 2; // easeInOutQuad
  const balloonY = restBalloonY + (config.size * ASCEND_BALLOON_TOP_FRAC - restBalloonY) * eased;
  const lemmingSize = config.lemmingSize * ASCEND_LEMMING_SCALE;
  return {
    ...base,
    phase: 'ascend',
    groundScrollY: eased * config.size * ASCEND_SCROLL_FRAC,
    balloonY,
    lemmingX: config.balloonX - lemmingSize / 2,
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
  frame: TheEndFrame,
  sceneImg: HTMLImageElement,
  balloonImg: HTMLImageElement,
): void {
  ctx.fillStyle = THE_END_SKY;
  ctx.fillRect(0, 0, size, size);
  if (ready(sceneImg)) ctx.drawImage(sceneImg, 0, frame.groundScrollY, size, size);
  if (ready(balloonImg)) {
    const balloonHeight = frame.balloonW * (balloonImg.naturalHeight / balloonImg.naturalWidth);
    ctx.drawImage(balloonImg, frame.balloonX - frame.balloonW / 2, frame.balloonY, frame.balloonW, balloonHeight);
  }
  ctx.save();
  ctx.translate(frame.lemmingX, frame.lemmingY);
  ctx.scale(frame.lemmingSize / LEMMING_GRID, frame.lemmingSize / LEMMING_GRID);
  drawLemmingShape(ctx, '#FFFFFF', frame.hairLevel);
  ctx.restore();
}
