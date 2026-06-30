import { describe, it, expect } from 'vitest';
import { TunnelRenderer } from './TunnelRenderer';
import {
  BREACH_BOOM_STEPS, BREACH_PAN_END_STEPS,
  type TunnelView,
} from './TunnelGame';
import { makeCanvas } from './test-helpers';

/** A breach-state TunnelView with neutral defaults; each test overrides only the
    fields its draw math reads, keeping the renderer decoupled from TunnelGame. */
function makeView(overrides: Partial<TunnelView> = {}): TunnelView {
  return {
    state: 'breach',
    cycle: 0,
    ceilingFrac: 0,
    crackXFrac: 0.5,
    floorBombs: [],
    placedCount: 0,
    breachStep: 0,
    stepCount: 0,
    fuseStepsLeft: 0,
    player: null,
    crushFlash: 0,
    padArriveSteps: 0,
    padNudgeSteps: 0,
    padNudgeDir: 1,
    reduceMotion: false,
    playerCenterFrac: () => 0.5,
    ...overrides,
  };
}

describe('TunnelRenderer — breach choreography', () => {
  const canvas = makeCanvas();

  it('the breach blasts the ground-hole open, then holds it open through the pan', () => {
    const renderer = new TunnelRenderer(canvas);
    const frame = (breachStep: number) => renderer['breachHoleFrame'](makeView({ breachStep }));
    expect(frame(1)).toBe(0);                        // boom: opens toward the last frame
    expect(frame(BREACH_BOOM_STEPS)).toBe(3);
    expect(frame(BREACH_PAN_END_STEPS)).toBe(3);     // pan: held fully open to arrival
  });

  it('the breach drop offset descends monotonically to a full canvas height', () => {
    const renderer = new TunnelRenderer(canvas);
    let prev = -1;
    for (let s = BREACH_BOOM_STEPS + 1; s <= BREACH_PAN_END_STEPS; s++) {
      const dropOffset = renderer['dropOffsetPx'](makeView({ breachStep: s }));
      expect(dropOffset).toBeGreaterThanOrEqual(prev); // the camera only ever drops further
      prev = dropOffset;
    }
    expect(prev).toBeCloseTo(canvas.height, 5); // arrived a full chamber down
  });
});
