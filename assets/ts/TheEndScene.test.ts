import { describe, it, expect } from 'vitest';
import {
  theEndFrameAt,
  ASCEND_SCROLL_FRAC,
  ASCEND_BALLOON_TOP_FRAC,
  type TheEndConfig,
  type TheEndDurations,
} from './TheEndScene';

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

describe('theEndFrameAt', () => {
  it('walks the lemming toward the balloon, ground still', () => {
    const frame = theEndFrameAt(0, null, durations, config);
    expect(frame.phase).toBe('walk');
    expect(frame.groundScrollY).toBe(0);
    expect(frame.boarded).toBe(false);
    expect(frame.lemmingX).toBeCloseTo(config.walkStartX);
  });

  it('reaches the prompt at the balloon once the walk completes', () => {
    const frame = theEndFrameAt(durations.walkMs, null, durations, config);
    expect(frame.phase).toBe('prompt');
    expect(frame.lemmingX).toBeCloseTo(config.walkEndX);
    expect(frame.groundScrollY).toBe(0);
  });

  it('boards before ascending: lemming shrinks into the basket, ground still', () => {
    const frame = theEndFrameAt(durations.boardMs / 2, 0, durations, config);
    expect(frame.phase).toBe('board');
    expect(frame.boarded).toBe(true);
    expect(frame.groundScrollY).toBe(0);
    expect(frame.lemmingSize).toBeLessThan(config.lemmingSize);
  });

  it('boards from the lemming\'s current walk position on an early lift-off (no jump)', () => {
    const liftOff = durations.walkMs / 2; // pressed mid-walk
    const walkPos = theEndFrameAt(liftOff, null, durations, config).lemmingX;
    const frame = theEndFrameAt(liftOff, liftOff, durations, config); // first board frame (boardProgress = 0)
    expect(frame.phase).toBe('board');
    expect(frame.lemmingX).toBeCloseTo(walkPos);
    expect(walkPos).toBeLessThan(config.walkEndX);
  });

  it('ascends after boarding: camera rises and hair goes wild', () => {
    const mid = durations.boardMs + durations.ascendMs / 2;
    const frame = theEndFrameAt(mid, 0, durations, config);
    expect(frame.phase).toBe('ascend');
    expect(frame.groundScrollY).toBeGreaterThan(0);
    expect(frame.hairLevel).toBe(4);
  });

  it('settles the end state: scene fully scrolled, balloon high in the sky', () => {
    const end = durations.boardMs + durations.ascendMs;
    const frame = theEndFrameAt(end, 0, durations, config);
    expect(frame.phase).toBe('ascend');
    expect(frame.groundScrollY).toBeCloseTo(config.size * ASCEND_SCROLL_FRAC);
    expect(frame.balloonY).toBeCloseTo(config.size * ASCEND_BALLOON_TOP_FRAC);
  });
});
