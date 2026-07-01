import { describe, it, expect } from 'vitest';
import {
  theEndFrameAt,
  ASCEND_SCROLL_FRAC,
  ASCEND_BALLOON_TOP_FRAC,
  theEndCreditsScroll,
  THE_END_CREDITS_MIN_SCROLL_MS,
  THE_END_CREDITS_SCROLL_PX_PER_S,
} from './TheEndScene';
import { THE_END_TEST_CONFIG as config, THE_END_TEST_DURATIONS as durations } from './theEndTestFixtures';

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

describe('theEndCreditsScroll', () => {
  it('scales crawl duration with travel distance', () => {
    const rollH = 200;
    const viewH = 500;
    const travelPx = rollH + viewH;
    const computed = Math.round((travelPx / THE_END_CREDITS_SCROLL_PX_PER_S) * 1000);
    expect(theEndCreditsScroll(rollH, viewH).ms).toBe(computed);
    expect(theEndCreditsScroll(0, 500).ms).toBe(THE_END_CREDITS_MIN_SCROLL_MS);
    expect(theEndCreditsScroll(200, 0).ms).toBe(THE_END_CREDITS_MIN_SCROLL_MS);
  });

  it('scroll end clears the roll once its bottom passes the viewport top', () => {
    expect(theEndCreditsScroll(200, 500).endPct).toBe(-(500 / 200) * 100);
  });
});
