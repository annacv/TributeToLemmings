/* Run scoring:
   TOTAL = surface seconds
         + tunnel seconds
         + 5 × levels completed (surface levels completed + tunnel cycles cleared)
*/

export const LEVEL_POINTS = 5;

export interface ScoreBreakdown {
  /** Seconds survived on the surface. */
  surfaceTime: number;
  /** Countdown seconds banked at tunnel cycle breakouts. */
  tunnelTime: number;
  /** 5 × levels completed (surface levels completed + tunnel cycles completed). */
  levelsBonus: number;
  /** Total score, derived via makeBreakdown. */
  total: number;
}

type BreakdownParts = Partial<Omit<ScoreBreakdown, 'total'>>;

export function makeBreakdown(parts: BreakdownParts = {}): ScoreBreakdown {
  const surfaceTime = parts.surfaceTime ?? 0;
  const tunnelTime = parts.tunnelTime ?? 0;
  const levelsBonus = parts.levelsBonus ?? 0;
  return {
    surfaceTime,
    tunnelTime,
    levelsBonus,
    total: surfaceTime + tunnelTime + levelsBonus,
  };
}

export interface BreakdownLine {
  label: string;
  rule: string;
  value: number;
}

export function breakdownLines(b: ScoreBreakdown): BreakdownLine[] {
  const levels = b.levelsBonus / LEVEL_POINTS;
  return [
    { label: 'Surface time', rule: `${b.surfaceTime} s`, value: b.surfaceTime },
    { label: 'Tunnel time', rule: `${b.tunnelTime} s`, value: b.tunnelTime },
    { label: 'Levels completed', rule: `${levels} × ${LEVEL_POINTS}`, value: b.levelsBonus },
  ];
}
