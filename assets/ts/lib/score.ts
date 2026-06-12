/* Run scoring, ratified for Iteration V:
   TOTAL = surface seconds + 10 × lives saved (per screen transition)
         + seconds left (per underground screen, banked per cycle)
         + 5 × cycles cleared
   The breakdown travels through every screen handoff; only `total` reaches the
   leaderboard. No other scoring source exists. */

export const LIFE_BONUS_POINTS = 10;
export const CYCLE_CLEAR_POINTS = 5;

export interface ScoreBreakdown {
  /** Seconds survived on the surface. */
  surface: number;
  /** 10 × lives remaining, converted at each screen transition. */
  livesBonus: number;
  /** Countdown seconds banked at tunnel cycle breakouts. */
  tunnelTime: number;
  /** 5 × cycles cleared, banked with the time slice. */
  cyclesBonus: number;
  /** Always the sum of the parts — derive via makeBreakdown, never by hand. */
  total: number;
}

type BreakdownParts = Partial<Omit<ScoreBreakdown, 'total'>>;

/** The only way to build a breakdown: total is derived from the parts, so the
    tally on screen can never disagree with the score that gets submitted. */
export function makeBreakdown(parts: BreakdownParts = {}): ScoreBreakdown {
  const surface = parts.surface ?? 0;
  const livesBonus = parts.livesBonus ?? 0;
  const tunnelTime = parts.tunnelTime ?? 0;
  const cyclesBonus = parts.cyclesBonus ?? 0;
  return {
    surface,
    livesBonus,
    tunnelTime,
    cyclesBonus,
    total: surface + livesBonus + tunnelTime + cyclesBonus,
  };
}

/** Lives-to-points conversion applied at every screen transition. */
export function livesBonusPoints(lives: number): number {
  return LIFE_BONUS_POINTS * Math.max(0, lives);
}
