import { playLoop, pauseWhileHidden } from './audio';

interface WorldLoopHost {
  muted: boolean;
  /** Read live each frame to stop resuming once the run is over. */
  readonly isOver: boolean;
  readonly runSignal: AbortSignal;
  sfx: { applyMute(muted: boolean): void };
}

/* The looping background-music wiring every simulation world shares: start the
   loop under the mute gate, pause it while the tab is hidden (dying with the run
   via its signal), and route the mute button to the loop + the SFX bank. Returns
   the Audio so the caller assigns it to its own field (the worlds tear it down
   differently in endRun). */
export function attachWorldLoop(
  game: WorldLoopHost,
  src: string,
  wireMute: (onToggle: (muted: boolean) => void) => void,
): HTMLAudioElement {
  const loop = new Audio(src);
  playLoop(loop, game.muted);
  pauseWhileHidden(loop, { signal: game.runSignal, shouldResume: () => !game.isOver });
  wireMute((muted) => { game.muted = muted; game.sfx.applyMute(muted); loop.muted = muted; });
  return loop;
}
