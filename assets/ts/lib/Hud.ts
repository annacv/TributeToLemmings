import type { StalactiteBreaks, StalactiteSize } from './score';
import { restartAnimation } from './fx';

/* Heads-Up Display controller, world-agnostic: any screen that keeps the
   established HUD class names (.seconds-value, .level-value, .lives-*) can
   reuse it as-is. Lookups are memoized — the HUD is static for the lifetime of
   a game screen, so each element hits the DOM once instead of every frame. */
export class Hud {
  private secondsValue?: HTMLElement | null;
  private hudScore?: HTMLElement | null;
  private levelValue?: HTMLElement | null;
  private levelItem?: HTMLElement | null;
  private levelUpBanner?: HTMLElement | null;
  private livesIcons?: HTMLElement | null;
  private livesValue?: HTMLElement | null;
  private livesItem?: HTMLElement | null;
  private abyssBombs?: HTMLElement | null;
  private abyssStalSmall?: HTMLElement | null;
  private abyssStalMedium?: HTMLElement | null;
  private abyssStalLarge?: HTMLElement | null;
  private lastScore: number | null = null;

  private getSecondsValue(): HTMLElement | null {
    return this.secondsValue ??= document.querySelector('.seconds-value');
  }

  private getHudScore(): HTMLElement | null {
    return this.hudScore ??= document.querySelector('.hud-score');
  }

  private getLevelValue(): HTMLElement | null {
    return this.levelValue ??= document.querySelector('.level-value');
  }

  private getLevelItem(): HTMLElement | null {
    return this.levelItem ??= document.querySelector('.level-item');
  }

  private getLevelUpBanner(): HTMLElement | null {
    return this.levelUpBanner ??= document.querySelector('.level-up-banner');
  }

  private getLivesIcons(): HTMLElement | null {
    return this.livesIcons ??= document.querySelector('.lives-icons');
  }

  private getLivesValue(): HTMLElement | null {
    return this.livesValue ??= document.querySelector('.lives-value');
  }

  private getLivesItem(): HTMLElement | null {
    return this.livesItem ??= document.querySelector('.lives-item');
  }

  private getAbyssBombs(): HTMLElement | null {
    return this.abyssBombs ??= document.querySelector('.abyss-bombs');
  }

  private getAbyssStal(size: StalactiteSize): HTMLElement | null {
    switch (size) {
      case 'small':
        return this.abyssStalSmall ??= document.querySelector('.abyss-stal[data-size="small"]');
      case 'medium':
        return this.abyssStalMedium ??= document.querySelector('.abyss-stal[data-size="medium"]');
      case 'large':
        return this.abyssStalLarge ??= document.querySelector('.abyss-stal[data-size="large"]');
    }
  }

  /** Writes the countdown only when it changes, returning whether
      the displayed value moved so callers can gate their own per-second updates. */
  setScore(score: number): boolean {
    if (score === this.lastScore) return false;
    this.lastScore = score;
    const el = this.getSecondsValue();
    if (el) el.textContent = String(score);
    return true;
  }

  setTimeWarning(on: boolean): void {
    this.getSecondsValue()?.classList.toggle('time-warning', on);
  }

  /** Floats a self-removing "+N" pop over the score slot at a cycle breakout. */
  popBank(points: number): void {
    const slot = this.getHudScore();
    if (!slot) return;
    const pop = document.createElement('span');
    pop.className = 'bank-pop';
    pop.textContent = `+${points}`;
    slot.appendChild(pop);
    pop.addEventListener('animationend', () => pop.remove(), { once: true });
  }

  blinkHudScore(): void {
    restartAnimation(this.getHudScore(), 'blink');
  }

  setLevel(label: string): void {
    const level = this.getLevelValue();
    if (level) level.textContent = label;
    restartAnimation(this.getLevelItem(), 'blink');
  }

  /** Announces a level via the center banner, replaying its show animation. */
  showLevelBanner(label: string): void {
    const banner = this.getLevelUpBanner();
    if (!banner) return;
    banner.textContent = label;
    restartAnimation(banner, 'show');
  }

  setLivesValue(lives: number): void {
    const el = this.getLivesValue();
    if (el) el.textContent = String(lives);
  }

  initLivesIcons(lives: number, iconSrc: string): void {
    const container = this.getLivesIcons();
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
    this.setLivesValue(lives);
    const container = this.getLivesIcons();
    if (!container) return;

    const activeIcons = container.querySelectorAll('.life-icon:not(.life-losing)');
    const excess = activeIcons.length - Math.max(0, lives);

    for (let i = 0; i < excess; i++) {
      const icon = activeIcons[activeIcons.length - 1 - i] as HTMLElement;
      icon.classList.add('life-losing');
      icon.addEventListener('animationend', () => icon.remove(), { once: true });
    }

    if (excess > 0) restartAnimation(this.getLivesItem(), 'blink');
  }

  setAbyssBombs(carried: number, cap: number): void {
    const el = this.getAbyssBombs();
    if (el) el.textContent = `${carried}/${cap}`;
  }

  updateAbyssStalactites(breaks: StalactiteBreaks, availableSizes: readonly StalactiteSize[]): void {
    for (const size of ['small', 'medium', 'large'] as const) {
      const item = this.getAbyssStal(size);
      if (!item) continue;
      const available = availableSizes.includes(size);
      item.toggleAttribute('hidden', !available);
      if (available) {
        const count = item.querySelector('.abyss-hint-count');
        if (count) count.textContent = String(breaks[size]);
      }
    }
  }
}
