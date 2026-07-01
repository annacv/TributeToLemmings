import { drawLemmingShape, LEMMING_GRID } from '../../entities/Player';
import { ready } from '../../lib/images';
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
  if (ready(sceneImg)) {
    const bgH = size * (sceneImg.naturalHeight / sceneImg.naturalWidth);
    ctx.drawImage(sceneImg, 0, size - bgH + frame.groundScrollY, size, bgH);
  }
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
