import { Game } from './Game';
import { SPRITES } from './assets';

const ICON_SOUND = `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" aria-hidden="true">
  <path d="M3 5.5H5.5L9 2.5v11L5.5 10.5H3a.5.5 0 01-.5-.5V6a.5.5 0 01.5-.5z"/>
  <path d="M10.5 6.5a2 2 0 010 3M12 4.5a5 5 0 010 7" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round"/>
</svg>`;

const ICON_MUTED = `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" aria-hidden="true">
  <path d="M3 5.5H5.5L9 2.5v11L5.5 10.5H3a.5.5 0 01-.5-.5V6a.5.5 0 01.5-.5z"/>
  <path d="M11 6.5l3 3M14 6.5l-3 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>`;

function main(): void {
  const mainElement = document.querySelector('#site-main') as HTMLElement;

  function buildDom(html: string): HTMLElement {
    mainElement.innerHTML = html;
    return mainElement;
  }

  function getCanvasSize(): number {
    const isDesktop = window.innerWidth >= 768;
    // CRT frame padding: 18px top + 26px bottom = 44px; sides 22px × 2 = 44px
    const frameVPad = isDesktop ? 44 : 0;
    const frameHPad = isDesktop ? 44 : 32;
    // header ~50px + footer ~96px + section padding/gaps/hint ~110px
    const uiHeight = 256;
    const maxByHeight = window.innerHeight - uiHeight - frameVPad;
    const maxByWidth = window.innerWidth - frameHPad;
    return Math.max(320, Math.min(maxByWidth, maxByHeight, 580));
  }

  function showInfoModal(onClose: () => void): void {
    if (localStorage.getItem('info-modal-dismissed')) {
      onClose();
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.id = 'info-modal-backdrop';
    backdrop.className = 'info-modal-backdrop';
    backdrop.innerHTML = `
      <div class="info-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button class="info-modal-close" aria-label="Close modal">&#x2715;</button>
        <h2 class="info-modal-title" id="modal-title">How to play</h2>
        <p class="info-modal-instruction">
          Use <kbd class="key-hint">&#x2190;</kbd> <kbd class="key-hint">&#x2192;</kbd> arrow keys<br>
          to dodge the bombs and stay alive!
        </p>
        <label class="info-modal-checkbox-label">
          <input type="checkbox" id="modal-no-show"> Don't show again
        </label>
        <button class="info-modal-btn">Got it!</button>
      </div>
    `;
    document.body.appendChild(backdrop);

    const checkbox = backdrop.querySelector('#modal-no-show') as HTMLInputElement;

    function closeModal(): void {
      if (checkbox.checked) localStorage.setItem('info-modal-dismissed', '1');
      backdrop.remove();
      onClose();
    }

    backdrop.querySelector('.info-modal-close')!.addEventListener('click', closeModal);
    backdrop.querySelector('.info-modal-btn')!.addEventListener('click', closeModal);
  }

  function createStartScreen(): void {
    buildDom(`
      <section class="splash-hero">
        <img class="splash-mascot" src="${SPRITES.lemming}" alt="Lemming mascot" />
        <h1 class="splash-title">Tribute to<br>Lemmings</h1>
        <p class="splash-tagline">&gt; skip the bombs. stay alive.</p>
        <button class="splash-start">Start</button>
      </section>
    `);

    mainElement.querySelector('button')!.addEventListener('click', createGameScreen);
  }

  function createGameScreen(): void {
    const size = getCanvasSize();
    const gameScreen = buildDom(`
      <section class="section-container play">
        <div class="touch-left">&lt;</div>
        <div class="touch-right">&gt;</div>
        <div class="crt-frame">
          <canvas class="game-canvas"></canvas>
          <div class="game-hud">
            <span class="hud-item">
              <span class="hud-label">lives</span>
              <span class="hud-value lives-value">3</span>
            </span>
            <span class="hud-item">
              <span class="hud-value seconds-value">0</span>
              <span class="hud-label">sec</span>
            </span>
          </div>
          <button class="mute-btn" aria-label="Mute sound"></button>
        </div>
        <p class="game-hint">&gt; use arrow keys to move the lemming</p>
      </section>
    `);

    const canvas = gameScreen.querySelector('canvas') as HTMLCanvasElement;
    canvas.width = size;
    canvas.height = size;

    const game = new Game(canvas);
    game.gameOverCallback(createGameOverScreen);

    const muteBtn = gameScreen.querySelector('.mute-btn') as HTMLButtonElement;
    const savedMute = localStorage.getItem('audio-muted') === '1';
    game.gameSong.muted = savedMute;
    muteBtn.innerHTML = savedMute ? ICON_MUTED : ICON_SOUND;
    muteBtn.setAttribute('aria-label', savedMute ? 'Unmute sound' : 'Mute sound');

    muteBtn.addEventListener('click', () => {
      game.gameSong.muted = !game.gameSong.muted;
      const muted = game.gameSong.muted;
      localStorage.setItem('audio-muted', muted ? '1' : '0');
      muteBtn.innerHTML = muted ? ICON_MUTED : ICON_SOUND;
      muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    });

    const arrowRight = gameScreen.querySelector('.touch-right') as HTMLElement;
    arrowRight.addEventListener('touchstart', () => game.player?.setDirection(1));

    const arrowLeft = gameScreen.querySelector('.touch-left') as HTMLElement;
    arrowLeft.addEventListener('touchstart', () => game.player?.setDirection(-1));

    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') game.player?.setDirection(1);
      else if (event.key === 'ArrowLeft') game.player?.setDirection(-1);
    });

    showInfoModal(() => game.startGame());
  }

  function createGameOverScreen(score: number): void {
    const size = getCanvasSize();
    const gameOverScreen = buildDom(`
      <section class="section-container game-over-screen">
        <div class="crt-frame">
          <canvas class="game-over-canvas"></canvas>
          <div class="game-over-overlay">
            <p class="go-boom">BOOOM!!!</p>
            <h1 class="go-title">GAME OVER</h1>
            <p class="go-score">score <span class="go-score-value"></span></p>
            <button class="splash-start go-restart">Restart</button>
          </div>
        </div>
      </section>
    `);

    const canvas = gameOverScreen.querySelector('.game-over-canvas') as HTMLCanvasElement;
    canvas.width = size;
    canvas.height = size;

    const scoreEl = gameOverScreen.querySelector('.go-score-value');
    if (scoreEl) scoreEl.textContent = String(score);

    gameOverScreen.querySelector('.go-restart')!.addEventListener('click', createGameScreen);
  }

  createStartScreen();
}

window.addEventListener('load', main);
