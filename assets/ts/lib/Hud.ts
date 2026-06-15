import { restartAnimation } from './fx';

/* Selector-driven Heads-Up Display controller, world-agnostic: any screen that keeps the
   established HUD class names (.seconds-value, .level-value, .lives-*) can
   reuse it as-is. Lookups are memoized — the HUD is static for the lifetime of
   a game screen, so each selector hits the DOM once instead of every frame. */
export class Hud {
  private els = new Map<string, HTMLElement | null>();

  el(selector: string): HTMLElement | null {
    let el = this.els.get(selector);
    if (el === undefined) {
      el = document.querySelector<HTMLElement>(selector);
      this.els.set(selector, el);
    }
    return el;
  }

  setText(selector: string, text: string): void {
    const el = this.el(selector);
    if (el) el.textContent = text;
  }

  blinkItem(selector: string): void {
    restartAnimation(this.el(selector), 'blink');
  }

  setScore(score: number): void {
    this.setText('.seconds-value', String(score));
  }

  setLevel(label: string): void {
    this.setText('.level-value', label);
    this.blinkItem('.level-item');
  }

  initLivesIcons(lives: number, iconSrc: string): void {
    const container = this.el('.lives-icons');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < lives; i++) {
      const img = document.createElement('img');
      img.src = iconSrc;
      img.className = 'life-icon';
      img.alt = '';
      container.appendChild(img);
    }
  }

  displayLives(lives: number): void {
    this.setText('.lives-value', String(lives));

    const container = this.el('.lives-icons');
    if (!container) return;
    const activeIcons = container.querySelectorAll('.life-icon:not(.life-losing)');
    const excess = activeIcons.length - Math.max(0, lives);
    for (let i = 0; i < excess; i++) {
      const icon = activeIcons[activeIcons.length - 1 - i] as HTMLElement;
      icon.classList.add('life-losing');
      icon.addEventListener('animationend', () => icon.remove(), { once: true });
    }
    if (excess > 0) this.blinkItem('.lives-item');
  }
}
