/* play() rejects under autoplay policy or when the source fails; audio is a
   nice-to-have here, so swallow instead of surfacing unhandled rejections */
export function safePlay(audio: HTMLAudioElement): void {
  audio.play().catch(() => {});
}
