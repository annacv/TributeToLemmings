/* The floor affordance both underground worlds share: a baseline with three evenly
   spaced ticks, centered on `centerX` at the floor seam */
export function drawFootingPad(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  floorY: number,
  padWidth: number,
  tickHeight: number,
  color: string,
  alpha: number,
): void {
  const tickWidth = Math.max(3, ctx.canvas.width * 0.012);
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = color;
  ctx.fillRect(centerX - padWidth / 2, floorY - 2, padWidth, 3); // footing baseline
  for (let i = 0; i < 3; i++) {
    const tickX = centerX - padWidth / 2 + (i + 0.5) * (padWidth / 3);
    ctx.fillRect(tickX - tickWidth / 2, floorY - tickHeight, tickWidth, tickHeight);
  }
  ctx.restore();
}
