/* Run scoring:
   TOTAL = surface seconds
         + tunnel seconds
         + abyss seconds
         + per-size stalactite bonuses (small/medium/large, weighted by size)
         + 5 × levels completed (surface levels + tunnel cycles + abyss levels)
*/

export const LEVEL_POINTS = 5;
export const STALACTITE_POINTS = { small: 5, medium: 10, large: 15 } as const;
export type StalactiteSize = keyof typeof STALACTITE_POINTS;
export type StalactiteBreaks = Record<StalactiteSize, number>;

const SIZES = ['small', 'medium', 'large'] as const;

export interface ScoreBreakdown {
  /** Seconds survived on the surface. */
  surfaceTime: number;
  /** Countdown seconds banked at tunnel cycle breakouts. */
  tunnelTime: number;
  /** Seconds survived in the abyss. */
  abyssTime: number;
  /** Stalactites broken, per size — drives the stalactite line's rule. */
  stalactites: StalactiteBreaks;
  /** Sum of per-size weights × counts (derived from stalactites). */
  stalactiteBonus: number;
  /** 5 × levels completed (surface levels + tunnel cycles + abyss levels). */
  levelsBonus: number;
  /** Total score, derived via makeBreakdown. */
  total: number;
}

interface BreakdownParts {
  surfaceTime?: number;
  tunnelTime?: number;
  abyssTime?: number;
  stalactites?: StalactiteBreaks;
  levelsBonus?: number;
}

export function makeBreakdown(parts: BreakdownParts = {}): ScoreBreakdown {
  const surfaceTime = parts.surfaceTime ?? 0;
  const tunnelTime = parts.tunnelTime ?? 0;
  const abyssTime = parts.abyssTime ?? 0;
  const levelsBonus = parts.levelsBonus ?? 0;
  // Copy so the breakdown never aliases the game's live counters.
  const stalactites: StalactiteBreaks = { small: 0, medium: 0, large: 0, ...parts.stalactites };
  const stalactiteBonus = SIZES.reduce((sum, size) => sum + stalactites[size] * STALACTITE_POINTS[size], 0);
  return {
    surfaceTime,
    tunnelTime,
    abyssTime,
    stalactites,
    stalactiteBonus,
    levelsBonus,
    total: surfaceTime + tunnelTime + abyssTime + stalactiteBonus + levelsBonus,
  };
}

export interface BreakdownLine {
  label: string;
  rule: string;
  value: number;
}

export function breakdownLines(b: ScoreBreakdown): BreakdownLine[] {
  const levels = b.levelsBonus / LEVEL_POINTS;
  const stalactiteRule = SIZES
    .filter((size) => b.stalactites[size] > 0)
    .map((size) => `${b.stalactites[size]}×${STALACTITE_POINTS[size]}`)
    .join(' + ') || '0';
  return [
    { label: 'Surface time', rule: `${b.surfaceTime} s`, value: b.surfaceTime },
    { label: 'Tunnel time', rule: `${b.tunnelTime} s`, value: b.tunnelTime },
    { label: 'Abyss time', rule: `${b.abyssTime} s`, value: b.abyssTime },
    { label: 'Stalactites', rule: stalactiteRule, value: b.stalactiteBonus },
    { label: 'Levels completed', rule: `${levels} × ${LEVEL_POINTS}`, value: b.levelsBonus },
  ];
}
