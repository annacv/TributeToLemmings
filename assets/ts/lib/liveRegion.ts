/* A single visually-hidden polite live region for announcing settled run results
   (final score, player rank) to assistive technology. The canvas worlds and the
   animated count-up are otherwise mute to screen readers; this gives them a voice
   without a visible-only dependency. Announce only completed values (never every
   count-up frame), once per outcome. Reused across screens — the VII finale will
   announce through the same region. */
let region: HTMLElement | null = null;

function ensureRegion(): HTMLElement {
  /* Screen swaps and tests reset the DOM, so re-create if the node is gone. */
  if (region && document.body.contains(region)) return region;
  region = document.createElement('div');
  region.className = 'visually-hidden';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  document.body.appendChild(region);
  return region;
}

/** Announce a settled result politely (waits for a pause, never interrupts). */
export function announce(message: string): void {
  ensureRegion().textContent = message;
}
