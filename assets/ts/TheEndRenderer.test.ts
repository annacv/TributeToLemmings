import { describe, it, expect } from 'vitest';
import { drawTheEndScene } from './TheEndRenderer';
import {
  theEndFrameAt,
  type TheEndConfig,
  type TheEndDurations,
} from './TheEndScene';
import { makeCtx } from './test-helpers';

const config: TheEndConfig = {
  size: 800,
  groundY: 688,
  balloonX: 496,
  balloonW: 272,
  lemmingSize: 112,
  walkStartX: 144,
  walkEndX: 430,
};
const durations: TheEndDurations = { walkMs: 1400, boardMs: 700, ascendMs: 4200 };

function pendingImage(): HTMLImageElement {
  return { complete: false, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement;
}

function readyImage(width: number, height: number): HTMLImageElement {
  return { complete: true, naturalWidth: width, naturalHeight: height } as HTMLImageElement;
}

describe('drawTheEndScene', () => {
  it('draws without throwing while scene images are still loading', () => {
    const ctx = makeCtx();
    const frame = theEndFrameAt(0, null, durations, config);
    expect(() =>
      drawTheEndScene(
        ctx as unknown as CanvasRenderingContext2D,
        config.size,
        frame,
        pendingImage(),
        pendingImage(),
      ),
    ).not.toThrow();
  });

  /* Settled end frame: mirrors the reduced-motion final draw in createTheEndScreen. */
  it('draws without throwing at the settled end state', () => {
    const ctx = makeCtx();
    const frame = theEndFrameAt(durations.boardMs + durations.ascendMs, 0, durations, config);
    const sceneImg = readyImage(config.size, config.size);
    const balloonImg = readyImage(config.balloonW, 423);
    expect(() =>
      drawTheEndScene(ctx as unknown as CanvasRenderingContext2D, config.size, frame, sceneImg, balloonImg),
    ).not.toThrow();
  });
});
