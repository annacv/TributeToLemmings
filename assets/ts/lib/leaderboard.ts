/* Lazy facade over lib/firebase: the firebase SDK is by far the heaviest
   dependency and the splash screen never needs it, so it loads in its own
   chunk on first use. Callers import this tiny module statically. */

const firebase = () => import('./firebase');

/** Warm the firebase chunk (e.g. during play) so game over finds it loaded. */
export function preloadLeaderboard(): void {
  void firebase();
}

export function submitScore(name: string, score: number): Promise<{ docId: string; bestScore: number }> {
  return firebase().then((m) => m.submitScore(name, score));
}

export function fetchTopScores(n: number): Promise<import('./firebase').ScoreRecord[]> {
  return firebase().then((m) => m.fetchTopScores(n));
}

export function getPlayerRank(score: number): Promise<number> {
  return firebase().then((m) => m.getPlayerRank(score));
}
