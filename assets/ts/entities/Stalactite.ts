import type { StalactiteSize } from '../lib/score';

export const STALACTITE_COST: Record<StalactiteSize, number> = { small: 1, medium: 2, large: 3 };

export class Stalactite {
  readonly size: StalactiteSize;
  readonly worldX: number;
  hitsRemaining: number;
  /** Render-only feedback state (never affects the hitbox/worldX). */
  shakeStepsLeft = 0;
  boomStepsLeft = 0;
  /** Set once hitsRemaining reaches 0 — the piece detaches, falls, and shatters. */
  destroyed = false;
  fallY = 0;
  shatterStepsLeft = 0;

  constructor(size: StalactiteSize, worldX: number) {
    this.size = size;
    this.worldX = worldX;
    this.hitsRemaining = STALACTITE_COST[size];
  }

  get cost(): number {
    return STALACTITE_COST[this.size];
  }

  /** Hits landed so far → crack-overlay index is `hitsTaken − 1` (0 = light). */
  get hitsTaken(): number {
    return this.cost - this.hitsRemaining;
  }
}
