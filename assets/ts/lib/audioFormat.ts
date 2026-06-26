/* Safari/iOS can't decode Ogg Vorbis, so each music loop ships as both .ogg
   (Chrome/Firefox/Android) and .m4a/AAC (Safari fallback). */
let canPlayOgg: boolean | undefined;

export function pickAudioSrc(oggUrl: string, m4aUrl: string): string {
  if (canPlayOgg === undefined) {
    const probe = typeof document !== 'undefined' ? document.createElement('audio') : null;
    canPlayOgg = probe && typeof probe.canPlayType === 'function'
      ? probe.canPlayType('audio/ogg; codecs="vorbis"') !== ''
      : true;
  }
  return canPlayOgg ? oggUrl : m4aUrl;
}
