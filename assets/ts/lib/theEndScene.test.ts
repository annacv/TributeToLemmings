import { describe, it, expect } from 'vitest';
import { theEndFrameAt, type TheEndCfg, type TheEndDurations } from './theEndScene';

const cfg: TheEndCfg = {
  size: 800,
  groundY: 688,
  balloonX: 496,
  balloonW: 272,
  lemmingSize: 112,
  walkStartX: 144,
  walkEndX: 430,
};
const dur: TheEndDurations = { walkMs: 1400, boardMs: 700, ascendMs: 4200 };

describe('theEndFrameAt', () => {
  it('walks the lemming toward the balloon, ground still', () => {
    const f = theEndFrameAt(0, null, dur, cfg);
    expect(f.phase).toBe('walk');
    expect(f.groundScrollY).toBe(0);
    expect(f.boarded).toBe(false);
    expect(f.lemmingX).toBeCloseTo(cfg.walkStartX);
  });

  it('reaches the prompt at the balloon once the walk completes', () => {
    const f = theEndFrameAt(dur.walkMs, null, dur, cfg);
    expect(f.phase).toBe('prompt');
    expect(f.lemmingX).toBeCloseTo(cfg.walkEndX);
    expect(f.groundScrollY).toBe(0);
  });

  it('boards before ascending: lemming shrinks into the basket, ground still', () => {
    const f = theEndFrameAt(dur.boardMs / 2, 0, dur, cfg);
    expect(f.phase).toBe('board');
    expect(f.boarded).toBe(true);
    expect(f.groundScrollY).toBe(0);
    expect(f.lemmingSize).toBeLessThan(cfg.lemmingSize);
  });

  it('ascends after boarding: camera rises and hair goes wild', () => {
    const mid = dur.boardMs + dur.ascendMs / 2;
    const f = theEndFrameAt(mid, 0, dur, cfg);
    expect(f.phase).toBe('ascend');
    expect(f.groundScrollY).toBeGreaterThan(0);
    expect(f.hairLevel).toBe(4);
  });

  it('settles the end state: scene fully scrolled, balloon high in the sky', () => {
    const end = dur.boardMs + dur.ascendMs;
    const f = theEndFrameAt(end, 0, dur, cfg);
    expect(f.phase).toBe('ascend');
    expect(f.groundScrollY).toBeCloseTo(cfg.size * 1.25);
    expect(f.balloonY).toBeCloseTo(cfg.size * 0.18);
  });
});
