import { ICON_ARROW_LEFT_SVG, ICON_ARROW_RIGHT_SVG } from '../assets';

export type InfoModalOptions = { screenName: string; title: string; bodyHtml: string; storageKey: string };

export const SURFACE_MODAL: InfoModalOptions = {
  screenName: 'The Surface',
  title: 'How to play',
  storageKey: 'surface-modal-dismissed',
  bodyHtml: `
        <p class="info-modal-instruction">
          Use <kbd class="key-hint">${ICON_ARROW_LEFT_SVG}</kbd> <kbd class="key-hint">${ICON_ARROW_RIGHT_SVG}</kbd> arrow keys<br>
          to dodge the bombs and stay alive!
        </p>`,
};

export const TUNNEL_MODAL: InfoModalOptions = {
  screenName: 'The Tunnel',
  title: 'How to play',
  storageKey: 'tunnel-modal-dismissed',
  bodyHtml: `
        <p class="info-modal-instruction">
          1. Find the crack and use <kbd class="key-hint-text">SPACE</kbd> to pick up and place the bombs.<br>
          2. Stand on the bombs, then <kbd class="key-hint-text">SPACE</kbd> <strong class="key-times">&times;3 times</strong> to light the fuse!<br>
        </p>
        <p class="info-modal-instruction">&gt; Escape fast! bonus per breakout.</p>`,
};

export const ABYSS_MODAL: InfoModalOptions = {
  screenName: 'The Abyss',
  title: 'How to play',
  storageKey: 'abyss-modal-dismissed',
  bodyHtml: `
        <p class="info-modal-instruction">
          1. Dodge the falling bombs, stand on them and use <kbd class="key-hint-text">SPACE</kbd> to pick them up (up to 3).<br>
          2. Use <kbd class="key-hint-text">SPACE</kbd> near a stalactite to throw a bomb up and smash it for points!
        </p>
        <p class="info-modal-instruction">&gt; Dodge, destroy and escape!</p>`,
};

export function showInfoModal(opts: InfoModalOptions, onClose: () => void): void {
  if (localStorage.getItem(opts.storageKey)) {
    onClose();
    return;
  }

  const backdrop = document.createElement('div');
  backdrop.id = 'info-modal-backdrop';
  backdrop.className = 'info-modal-backdrop';
  backdrop.innerHTML = `
      <div class="info-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button class="info-modal-close" aria-label="Close modal">&#x2715;</button>
        <p class="info-modal-screen">-- ${opts.screenName} --</p>
        <h2 class="info-modal-title" id="modal-title">${opts.title}</h2>
        ${opts.bodyHtml}
        <label class="info-modal-checkbox-label">
          <input type="checkbox" id="modal-no-show"> Don't show again
        </label>
        <button class="info-modal-btn">Got it!</button>
      </div>
    `;
  document.body.appendChild(backdrop);

  const checkbox = backdrop.querySelector('#modal-no-show') as HTMLInputElement;
  const closeBtn = backdrop.querySelector('.info-modal-close') as HTMLButtonElement;
  const confirmBtn = backdrop.querySelector('.info-modal-btn') as HTMLButtonElement;

  function closeModal(): void {
    document.removeEventListener('keydown', onModalKeydown);
    if (checkbox.checked) localStorage.setItem(opts.storageKey, '1');
    backdrop.remove();
    onClose();
  }

  function onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      closeModal();
    } else if (event.key === 'Tab') {
      if (event.shiftKey && document.activeElement === closeBtn) {
        event.preventDefault();
        confirmBtn.focus();
      } else if (!event.shiftKey && document.activeElement === confirmBtn) {
        event.preventDefault();
        closeBtn.focus();
      }
    }
  }

  document.addEventListener('keydown', onModalKeydown);
  closeBtn.addEventListener('click', closeModal);
  confirmBtn.addEventListener('click', closeModal);
  confirmBtn.focus();
}
