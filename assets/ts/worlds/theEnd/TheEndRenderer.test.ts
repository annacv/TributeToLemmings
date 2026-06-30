import { describe, it, expect } from 'vitest';
import { drawTheEndScene } from './TheEndRenderer';
import { theEndFrameAt } from './TheEndScene';
import { makeCtx, mockPendingImage, mockReadyImage } from '../../test-helpers';
import { THE_END_TEST_CONFIG as config, THE_END_TEST_DURATIONS as durations } from './theEndTestFixtures';

describe('drawTheEndScene', () => {
  it('draws without throwing while scene images are still loading', () => {
    const ctx = makeCtx();
    const frame = theEndFrameAt(0, null, durations, config);
    expect(() =>
      drawTheEndScene(
        ctx as unknown as CanvasRenderingContext2D,
        config.size,
        frame,
        mockPendingImage(),
        mockPendingImage(),
      ),
    ).not.toThrow();
  });

  /* Settled end frame: mirrors the reduced-motion final draw in createTheEndScreen. */
  it('draws without throwing at the settled end state', () => {
    const ctx = makeCtx();
    const frame = theEndFrameAt(durations.boardMs + durations.ascendMs, 0, durations, config);
    const sceneImg = mockReadyImage(config.size, config.size);
    const balloonImg = mockReadyImage(config.balloonW, 423);
    expect(() =>
      drawTheEndScene(ctx as unknown as CanvasRenderingContext2D, config.size, frame, sceneImg, balloonImg),
    ).not.toThrow();
  });
});
