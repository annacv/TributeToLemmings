import * as audio from './audio';

export interface SoundEffectOptions {
  /** Per-play volume (0–1); persists on the element until the next override. */
  volume?: number;
  /** Per-play playback rate; persists on the element until the next override. */
  playbackRate?: number;
}

/* Name-keyed pool of one-shot / loop sound effects sharing one mute gate.
   Each screen keeps its own mute source of truth with no second copy to keep in sync.
   Long-lived music and event-sequenced audio stay bespoke on their owners;
   this bank is for fire-and-forget effects. */
export class SoundEffectBank {
  private readonly sounds: Map<string, HTMLAudioElement>;

  constructor(sources: Record<string, string>, private readonly isMuted: () => boolean) {
    this.sounds = new Map(
      Object.entries(sources).map(([name, src]) => [name, new Audio(src)]),
    );
  }

  play(name: string, opts: SoundEffectOptions = {}): void {
    const sfx = this.sounds.get(name);
    if (!sfx) return;
    if (opts.volume !== undefined) sfx.volume = opts.volume;
    if (opts.playbackRate !== undefined) sfx.playbackRate = opts.playbackRate;
    audio.playSfx(sfx, this.isMuted());
  }

  /** Starts a looping channel (mute keeps it running silently, matching playLoop). */
  loop(name: string): void {
    const sfx = this.sounds.get(name);
    if (sfx) audio.playLoop(sfx, this.isMuted());
  }

  stopLoop(name: string): void {
    const sfx = this.sounds.get(name);
    if (sfx) audio.stopLoop(sfx);
  }

  /** Applies the mute state to live looping channels, so toggling mute mid-loop
      takes effect on the spot. One-shots need nothing — they re-read the predicate
      on each play. */
  applyMute(muted: boolean): void {
    for (const sfx of this.sounds.values()) {
      if (sfx.loop) sfx.muted = muted;
    }
  }

  /** The underlying element — for tests and any bespoke sequencing a caller needs. */
  get(name: string): HTMLAudioElement | undefined {
    return this.sounds.get(name);
  }
}
