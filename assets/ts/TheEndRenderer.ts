import { drawLemmingShape, LEMMING_GRID } from './Player';
import { ready } from './lib/images';
import type { TheEndFrame } from './TheEndScene';

export const THE_END_SKY = '#00C8FF'; // matches background-theend.svg's sky, filled above the scrolled scene

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
