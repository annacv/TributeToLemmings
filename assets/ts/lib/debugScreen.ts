/* Dev-only screen seam. `?screen=tbc` / `?screen=tunnel` jumps straight to that
   screen for playtesting and marks the run so its score is never submitted to the
   leaderboard. `import.meta.env.DEV` gates it to dev builds, so production tree-
   shakes the whole thing out — it never reaches the shipped bundle.

   Stateless on purpose: the value is read fresh from the URL each call (the tests
   set the query string then dispatch `load`, so it must not be captured at import
   time), and `consumeDebugScreen` clears the param so later reads return null. */

/** The active debug screen (`'tbc'` | `'tunnel'` | …), or null outside dev / when absent. */
export function getDebugScreen(): string | null {
  return import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('screen')
    : null;
}

/** Drops the `?screen=` param so a normal game started from such a URL submits its
    score (and the seam doesn't re-trigger on reload). */
export function consumeDebugScreen(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('screen')) return;
  url.searchParams.delete('screen');
  history.replaceState(null, '', url);
}
