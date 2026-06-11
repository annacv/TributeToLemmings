/* play() rejects under autoplay policy or when the source fails; audio is a
   nice-to-have here, so swallow instead of surfacing unhandled rejections */
export function safePlay(audio: HTMLAudioElement): void {
  audio.play().catch(() => {});
}

/** One-shot SFX channel: rewinds and plays unless muted. */
export function playSfx(sfx: HTMLAudioElement, muted: boolean): void {
  if (muted) return;
  sfx.currentTime = 0;
  safePlay(sfx);
}

/** Looping channel (music, fuse tick): mute keeps the loop running silently so
    unmuting mid-loop resumes in place, matching the music elements' behavior. */
export function playLoop(loop: HTMLAudioElement, muted: boolean): void {
  loop.loop = true;
  loop.muted = muted;
  safePlay(loop);
}

export function stopLoop(loop: HTMLAudioElement): void {
  loop.pause();
  loop.currentTime = 0;
}

/** A hidden tab freezes the game (rAF stops) but audio keeps playing — pause
    while hidden and resume on return only while `shouldResume` allows it, so a
    dead run can't talk over the next screen's music. */
export function pauseWhileHidden(
  audio: HTMLAudioElement,
  opts: { signal?: AbortSignal; shouldResume?: () => boolean } = {},
): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause();
    else if (opts.shouldResume?.() ?? true) safePlay(audio);
  }, { signal: opts.signal });
}
