import { vi } from 'vitest';

export class SettledImage {
  complete = true;
  naturalWidth = 1;
  src = '';
  addEventListener(): void {}
}

/** Images whose load/error never fire — exercises pending-asset routing in seam tests. */
export class PendingImage {
  complete = false;
  naturalWidth = 0;
  src = '';
  addEventListener(): void {}
}

export function mountSiteMain(): void {
  document.body.innerHTML = '<main id="site-main"></main>';
  window.dispatchEvent(new Event('load'));
}

export function bootSplashGame(): void {
  mountSiteMain();
  (document.querySelector('.splash-start') as HTMLButtonElement).click();
}

export type DebugScreen = 'tunnel' | 'abyss' | 'theend';

export function bootDebugScreen(screen: DebugScreen): void {
  mountSiteMain();
  history.replaceState(null, '', `/?screen=${screen}`);
  window.dispatchEvent(new Event('load'));
}

/** Wraps Audio so seam tests can assert on constructed sources. */
export function stubAudioTracking(): { sources: string[] } {
  const sources: string[] = [];
  const RealAudio = window.Audio;
  vi.stubGlobal('Audio', function (src?: string) {
    sources.push(src ?? '');
    return new RealAudio(src);
  });
  return { sources };
}
