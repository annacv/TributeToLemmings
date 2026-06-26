import { ICON_SOUND_SVG, ICON_MUTED_SVG } from '../assets';

/* Wires a mute button to the persisted `audio-muted` flag: renders the right icon
   and aria-label for the current state, and on click flips the flag, swaps the
   icon/label, and calls back so each screen applies mute to its own audio. */
export function setupMuteButton(btn: HTMLButtonElement, onToggle: (muted: boolean) => void): void {
  const muted = localStorage.getItem('audio-muted') === '1';
  btn.innerHTML = muted ? ICON_MUTED_SVG : ICON_SOUND_SVG;
  btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  btn.addEventListener('click', () => {
    const nowMuted = localStorage.getItem('audio-muted') !== '1';
    localStorage.setItem('audio-muted', nowMuted ? '1' : '0');
    btn.innerHTML = nowMuted ? ICON_MUTED_SVG : ICON_SOUND_SVG;
    btn.setAttribute('aria-label', nowMuted ? 'Unmute sound' : 'Mute sound');
    onToggle(nowMuted);
  });
}
