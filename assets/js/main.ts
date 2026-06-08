import { Game } from './Game';
import { drawLemmingMascot } from './Player';
import { submitScore, fetchTopScores, getPlayerRank } from './lib/firebase';

const GAME_OVER_TRANSITION_MS = 2000;

const ICON_SOUND = `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" aria-hidden="true">
  <path d="M3 5.5H5.5L9 2.5v11L5.5 10.5H3a.5.5 0 01-.5-.5V6a.5.5 0 01.5-.5z"/>
  <path d="M10.5 6.5a2 2 0 010 3M12 4.5a5 5 0 010 7" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round"/>
</svg>`;

const ICON_MUTED = `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" aria-hidden="true">
  <path d="M3 5.5H5.5L9 2.5v11L5.5 10.5H3a.5.5 0 01-.5-.5V6a.5.5 0 01.5-.5z"/>
  <path d="M11 6.5l3 3M14 6.5l-3 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>`;

export function generateGuestHandle(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 3; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return `Lemming #${id}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function main(): void {
  const mainElement = document.querySelector('#site-main') as HTMLElement;
  let playerName = '';

  function buildDom(html: string): HTMLElement {
    mainElement.innerHTML = html;
    return mainElement;
  }

  function getCanvasSize(): number {
    const isDesktop = window.innerWidth >= 768;
    const frameVPad = isDesktop ? 44 : 0;
    const frameHPad = isDesktop ? 44 : 32;
    const uiHeight = 256;
    const maxByHeight = window.innerHeight - uiHeight - frameVPad;
    const viewportWidth = document.documentElement.clientWidth;
    const maxByWidth = viewportWidth - frameHPad;
    return Math.max(280, Math.min(maxByWidth, maxByHeight, 580));
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
        <canvas class="splash-mascot" aria-label="Lemming mascot"></canvas>
        <h1 class="splash-title">Tribute to<br>Lemmings</h1>
        <p class="splash-tagline">&gt; skip the bombs. stay alive.</p>
        <div class="splash-name-wrap">
          <input
            class="splash-name-input"
            type="text"
            maxlength="20"
            placeholder="Enter your name"
            autocomplete="off"
            spellcheck="false"
          >
          <p class="splash-name-notice">&gt; your nickname &amp; score will be saved to a public leaderboard.</p>
        </div>
        <button class="splash-start">Start</button>
      </section>
    `);

    const mascotCanvas = mainElement.querySelector('.splash-mascot') as HTMLCanvasElement;
    mascotCanvas.width = 142;
    mascotCanvas.height = 142;
    const mascotCtx = mascotCanvas.getContext('2d')!;

    let mascotFrame = 0;
    let mascotRafId: number;
    function animateMascot(): void {
      drawLemmingMascot(mascotCtx, 142, mascotFrame++);
      mascotRafId = requestAnimationFrame(animateMascot);
    }
    animateMascot();

    const nameInput = mainElement.querySelector('.splash-name-input') as HTMLInputElement;
    const startBtn = mainElement.querySelector('.splash-start') as HTMLButtonElement;
    if (playerName) {
      nameInput.value = playerName;
      startBtn.focus();
    }

    startBtn.addEventListener('click', () => {
      cancelAnimationFrame(mascotRafId);
      const input = mainElement.querySelector('.splash-name-input') as HTMLInputElement;
      playerName = input.value.trim() || generateGuestHandle();
      createGameScreen();
    });
  }

  function createGameScreen(): void {
    const size = getCanvasSize();
    const gameScreen = buildDom(`
      <section class="section-container play">
        <div class="crt-frame">
          <canvas class="game-canvas"></canvas>
          <div class="game-hud">
            <div class="hud-lives">
              <span class="hud-item">
                <span class="hud-label">lives</span>
                <span class="hud-value lives-value">3</span>
              </span>
              <div class="lives-icons"></div>
            </div>
            <span class="hud-item">
              <span class="hud-value seconds-value">0</span>
              <span class="hud-label">sec</span>
            </span>
          </div>
          <button class="mute-btn" aria-label="Mute sound"></button>
        </div>
        <div class="touch-controls">
          <button class="touch-left" aria-label="Move left">&#x2190;</button>
          <button class="touch-right" aria-label="Move right">&#x2192;</button>
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
    arrowRight.addEventListener('click', () => game.player?.setDirection(1));

    const arrowLeft = gameScreen.querySelector('.touch-left') as HTMLElement;
    arrowLeft.addEventListener('touchstart', () => game.player?.setDirection(-1));
    arrowLeft.addEventListener('click', () => game.player?.setDirection(-1));

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
          </div>
        </div>
      </section>
    `);

    const canvas = gameOverScreen.querySelector('.game-over-canvas') as HTMLCanvasElement;
    canvas.width = size;
    canvas.height = size;

    const scoreEl = gameOverScreen.querySelector('.go-score-value');
    if (scoreEl) scoreEl.textContent = String(score);

    const submission: Promise<{ error: boolean; docId: string | null }> = submitScore(playerName, score)
      .then((docId) => ({ error: false, docId }))
      .catch(() => ({ error: true, docId: null }));

    setTimeout(() => createRankingScreen(score, submission), GAME_OVER_TRANSITION_MS);
  }

  function createRankingScreen(currentScore: number, submission: Promise<{ error: boolean; docId: string | null }>): void {
    const size = getCanvasSize();
    buildDom(`
      <section class="section-container ranking-screen">
        <div class="crt-frame">
          <canvas class="ranking-canvas"></canvas>
          <div class="ranking-overlay">
            <h1 class="ranking-title">Hall of Fame</h1>
            <div class="ranking-list">
              <p class="ranking-loading">&gt; loading...</p>
            </div>
            <button class="splash-start ranking-play-again">Play again</button>
          </div>
        </div>
      </section>
    `);

    const canvas = mainElement.querySelector('.ranking-canvas') as HTMLCanvasElement;
    canvas.width = size;
    canvas.height = size;

    mainElement.querySelector('.ranking-play-again')!.addEventListener('click', createStartScreen);

    loadRanking(currentScore, submission);
  }

  async function loadRanking(currentScore: number, submission: Promise<{ error: boolean; docId: string | null }>): Promise<void> {
    const listEl = mainElement.querySelector('.ranking-list');
    if (!listEl) return;

    try {
      const scores = await fetchTopScores(10);

      if (!mainElement.querySelector('.ranking-list')) return; // navigated away

      // Give submission up to 1 s after scores arrive; fall back to failed if still pending
      const { error: submissionError, docId: submittedDocId } = await Promise.race([
        submission,
        new Promise<{ error: boolean; docId: string | null }>((resolve) =>
          setTimeout(() => resolve({ error: true, docId: null }), 1000)
        ),
      ]);

      if (!mainElement.querySelector('.ranking-list')) return;

      if (submissionError && !mainElement.querySelector('.ranking-save-error')) {
        const overlay = mainElement.querySelector('.ranking-overlay');
        const title = overlay?.querySelector('.ranking-title');
        if (overlay && title) {
          const banner = document.createElement('p');
          banner.className = 'ranking-save-error';
          banner.textContent = '> score could not be saved.';
          overlay.insertBefore(banner, title);
        }
      }

      if (scores.length === 0) {
        let html = '<p class="ranking-empty">&gt; no scores yet — be the first!</p>';
        if (currentScore > 0 && submittedDocId !== null) {
          const rank = await getPlayerRank(currentScore);
          if (!mainElement.querySelector('.ranking-list')) return;
          html += `
            <hr class="ranking-divider">
            <div class="ranking-row ranking-row--current">
              <span class="ranking-rank">${rank}.</span>
              <span class="ranking-name">${escapeHtml(playerName)}</span>
              <span class="ranking-score">${currentScore}s</span>
            </div>
          `;
        }
        listEl.innerHTML = html;
        return;
      }

      const playerInTop10 = submittedDocId !== null && scores.some((s) => s.id === submittedDocId);

      let html = '<ol class="ranking-table">';
      let displayRank = 1;
      scores.forEach((s, i) => {
        if (i > 0 && s.score < scores[i - 1].score) displayRank = i + 1;
        const isCurrent = submittedDocId !== null && s.id === submittedDocId;
        html += `<li class="ranking-row${isCurrent ? ' ranking-row--current' : ''}">
          <span class="ranking-rank">${displayRank}.</span>
          <span class="ranking-name">${escapeHtml(s.name)}</span>
          <span class="ranking-score">${s.score}s</span>
        </li>`;
      });
      html += '</ol>';

      if (!playerInTop10) {
        const rank = await getPlayerRank(currentScore);
        if (!mainElement.querySelector('.ranking-list')) return;
        html += `
          <hr class="ranking-divider">
          ${rank > 10 ? '<p class="ranking-not-top10">&gt; you are still not in the top 10</p>' : ''}
          <div class="ranking-row ranking-row--current">
            <span class="ranking-rank">${rank}.</span>
            <span class="ranking-name">${escapeHtml(playerName)}</span>
            <span class="ranking-score">${currentScore}s</span>
          </div>
        `;
      }

      listEl.innerHTML = html;
    } catch {
      if (!mainElement.querySelector('.ranking-list')) return;
      const { error: submissionError } = await Promise.race([
        submission,
        new Promise<{ error: boolean; docId: string | null }>((resolve) =>
          setTimeout(() => resolve({ error: true, docId: null }), 1000)
        ),
      ]);
      if (!mainElement.querySelector('.ranking-list')) return;
      if (submissionError && !mainElement.querySelector('.ranking-save-error')) {
        const overlay = mainElement.querySelector('.ranking-overlay');
        const title = overlay?.querySelector('.ranking-title');
        if (overlay && title) {
          const banner = document.createElement('p');
          banner.className = 'ranking-save-error';
          banner.textContent = '> score could not be saved.';
          overlay.insertBefore(banner, title);
        }
      }
      listEl.innerHTML = `
        <p class="ranking-error">&gt; could not load rankings.</p>
        <a class="ranking-retry" href="#">try again</a>
      `;
      listEl.querySelector('.ranking-retry')?.addEventListener('click', (e) => {
        e.preventDefault();
        listEl.innerHTML = '<p class="ranking-loading">&gt; loading...</p>';
        loadRanking(currentScore, submission);
      });
    }
  }

  createStartScreen();
}

window.addEventListener('load', main);
