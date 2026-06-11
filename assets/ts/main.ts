import { Game } from './Game';
import { drawLemmingMascot, drawLemmingShape } from './Player';
import { submitScore, fetchTopScores, getPlayerRank, preloadLeaderboard } from './lib/leaderboard';
import { safePlay } from './lib/audio';
import { DIE_SFX, RANKING_MUSIC, FALLING_SFX, UNDERGROUND_BACKGROUND_SVG } from './assets';

const GAME_OVER_TRANSITION_MS = 2000;
const SUBMISSION_TIMEOUT_MS = 2500;
const TBC_FALL_DURATION_MS = 500;
const TBC_SCROLL_DURATION_MS = 1700;
const TBC_REST_FADE_MS = 500;
const TBC_TRANSITION_MS = 3000;

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
  for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return `Lemming #${id}`;
}

type SubmissionResult = { error: boolean; docId: string | null; bestScore: number | null };

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
  let rankingMusic: HTMLAudioElement | null = null;

  /* Dev-only shortcut (?screen=tbc) to replay the interstitial; skips score submission */
  let debugScreen = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('screen')
    : null;

  /* Same rule as the game song: no music in a hidden tab */
  document.addEventListener('visibilitychange', () => {
    if (!rankingMusic) return;
    if (document.hidden) rankingMusic.pause();
    else safePlay(rankingMusic);
  });

  function consumeDebugScreen(): void {
    if (!debugScreen) return;
    debugScreen = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('screen');
    history.replaceState(null, '', url);
  }

  function buildDom(html: string): HTMLElement {
    mainElement.innerHTML = html;
    return mainElement;
  }

  function setupMuteButton(btn: HTMLButtonElement, onToggle: (muted: boolean) => void): void {
    const muted = localStorage.getItem('audio-muted') === '1';
    btn.innerHTML = muted ? ICON_MUTED : ICON_SOUND;
    btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    btn.addEventListener('click', () => {
      const nowMuted = localStorage.getItem('audio-muted') !== '1';
      localStorage.setItem('audio-muted', nowMuted ? '1' : '0');
      btn.innerHTML = nowMuted ? ICON_MUTED : ICON_SOUND;
      btn.setAttribute('aria-label', nowMuted ? 'Unmute sound' : 'Mute sound');
      onToggle(nowMuted);
    });
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
    const closeBtn = backdrop.querySelector('.info-modal-close') as HTMLButtonElement;
    const confirmBtn = backdrop.querySelector('.info-modal-btn') as HTMLButtonElement;

    function closeModal(): void {
      document.removeEventListener('keydown', onModalKeydown);
      if (checkbox.checked) localStorage.setItem('info-modal-dismissed', '1');
      backdrop.remove();
      onClose();
    }

    /* aria-modal promises focus stays inside: Escape closes, Tab wraps over the
       three focusables (close button, checkbox, confirm button) */
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

  function createStartScreen(): void {
    buildDom(`
      <section class="splash-hero">
        <canvas class="splash-mascot" role="img" aria-label="Lemming mascot"></canvas>
        <h1 class="splash-title">Tribute to<br>Lemmings</h1>
        <p class="splash-tagline">&gt; skip the bombs. stay alive.</p>
        <form class="splash-form">
          <div class="splash-name-wrap">
            <input
              class="splash-name-input"
              type="text"
              maxlength="20"
              placeholder="Enter your name"
              aria-label="Your nickname"
              autocomplete="off"
              spellcheck="false"
            >
            <p class="splash-name-notice">&gt; your nickname &amp; score will be saved to a public leaderboard.</p>
          </div>
          <button class="splash-start" type="submit">Start</button>
        </form>
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

    /* Form submit covers both the Start button and Enter in the name input
       (incl. the mobile keyboard's Go key); an empty name falls back to a guest handle */
    const form = mainElement.querySelector('.splash-form') as HTMLFormElement;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      cancelAnimationFrame(mascotRafId);
      playerName = nameInput.value.trim() || generateGuestHandle();
      consumeDebugScreen();
      createGameScreen();
    });
  }

  function createGameScreen(): void {
    
    preloadLeaderboard();

    const size = getCanvasSize();
    const gameScreen = buildDom(`
      <section class="section-container play">
        <div class="crt-frame">
          <canvas class="game-canvas" role="img" aria-label="Game area — dodge the falling bombs"></canvas>
          <p class="level-up-banner"></p>
          <div class="game-hud">
            <div class="hud-lives">
              <span class="hud-item lives-item">
                <span class="hud-label">lives</span>
                <span class="hud-value lives-value">3</span>
              </span>
              <div class="lives-icons"></div>
            </div>
            <div class="hud-score">
              <span class="hud-item">
                <span class="hud-value seconds-value">0</span>
                <span class="hud-label">sec</span>
              </span>
              <span class="hud-item level-item">
                <span class="hud-label">level</span>
                <span class="hud-value level-value">1</span>
              </span>
            </div>
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
    game.tunnelWorldCallback(createToBeContinuedScreen);

    game.gameSong.muted = localStorage.getItem('audio-muted') === '1';
    setupMuteButton(
      gameScreen.querySelector('.mute-btn') as HTMLButtonElement,
      (muted) => { game.gameSong.muted = muted; },
    );

    const arrowRight = gameScreen.querySelector('.touch-right') as HTMLElement;
    arrowRight.addEventListener('touchstart', () => game.player?.setDirection(1));
    arrowRight.addEventListener('click', () => game.player?.setDirection(1));

    const arrowLeft = gameScreen.querySelector('.touch-left') as HTMLElement;
    arrowLeft.addEventListener('touchstart', () => game.player?.setDirection(-1));
    arrowLeft.addEventListener('click', () => game.player?.setDirection(-1));

    /* Dies with the run (runSignal aborts at halt), so listeners don't
       stack up across play-again cycles */
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') game.player?.setDirection(1);
      else if (event.key === 'ArrowLeft') game.player?.setDirection(-1);
    }, { signal: game.runSignal });

    /* Screen swaps blow away the focused element; re-anchor focus so keyboard
       and screen-reader users aren't dropped to <body> */
    canvas.tabIndex = -1;
    canvas.focus();

    showInfoModal(() => {
      canvas.focus();
      game.startGame();
    });
  }

  function createToBeContinuedScreen(score: number): void {
    const size = getCanvasSize();
    const screen = buildDom(`
      <section class="section-container to-be-continued-screen">
        <div class="crt-frame">
          <canvas class="tbc-canvas" aria-hidden="true"></canvas>
          <div class="tbc-overlay">
            <p class="tbc-line">TO BE CONTINUED...</p>
          </div>
        </div>
      </section>
    `);

    const canvas = screen.querySelector('.tbc-canvas') as HTMLCanvasElement;
    canvas.width = size;
    canvas.height = size;
    canvas.tabIndex = -1;
    canvas.focus();
    const ctx = canvas.getContext('2d')!;

    const undergroundImg = new Image();
    undergroundImg.src = UNDERGROUND_BACKGROUND_SVG;

    if (localStorage.getItem('audio-muted') !== '1') {
      safePlay(new Audio(FALLING_SFX));
    }

    const lemmingSize = size * 0.14;
    const HOLE_CENTER_Y_FRAC = 0.435;
    const GROUND_EROSION_ASPECT = 299 / 400;
    const BG_ZOOM = 1.5;
    const BG_CROP_TOP_FRAC = 547 / 800;
    const bgSize = size * BG_ZOOM;
    const surfaceBottomY = bgSize * (1 - BG_CROP_TOP_FRAC);
    /* Mirrors the shaft geometry baked into background-underground.svg (slot top
       at canvas 0.02, erosion slot 0.85 wide) so the lemming lands in row 0's hole */
    const erosionFrameW = size * 0.85;
    const erosionFrameH = erosionFrameW * GROUND_EROSION_ASPECT;
    const erosionStackTop = size * 0.02;
    const SCROLL_DISTANCE = surfaceBottomY + 2 * size;
    const holeCenterY = erosionStackTop + erosionFrameH * HOLE_CENTER_Y_FRAC;
    const holeX = size * 0.5 - lemmingSize / 2;
    const holeY = holeCenterY - lemmingSize / 2;

    /* Debris anchored in world space below the ground; streams past during the
       scroll but never comes to rest inside the final dark frame */
    const specks = Array.from({ length: 26 }, () => ({
      x: Math.random() * size,
      y: size * 1.05 + Math.random() * (SCROLL_DISTANCE - size * 1.6),
      w: 2 + Math.random() * 3,
      h: 6 + Math.random() * 8,
    }));

    function drawScene(lemmingY: number, scrollY: number, veilAlpha: number): void {
      ctx.clearRect(0, 0, size, size);
      /* One draw for the whole world: surface, shaft, dirt, veils, dark, hints */
      if (undergroundImg.complete && undergroundImg.naturalWidth > 0) {
        ctx.drawImage(undergroundImg, 0, surfaceBottomY - size * 0.5 - scrollY, size, size * 3.5);
      }
      if (scrollY > 0) {
        ctx.fillStyle = '#3a3426';
        for (const speck of specks) {
          const speckY = speck.y - scrollY;
          if (speckY > -speck.h && speckY < size) ctx.fillRect(speck.x, speckY, speck.w, speck.h);
        }
      }
      /* Rest-beat veil: lifts after the camera settles so the hint fragments breathe in */
      if (veilAlpha > 0) {
        ctx.globalAlpha = veilAlpha;
        ctx.fillStyle = '#0d062b';
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(holeX, lemmingY);
      ctx.scale(lemmingSize / 142, lemmingSize / 142);
      drawLemmingShape(ctx, '#FFFFFF', scrollY > 0 ? 4 : 0);
      ctx.restore();
    }

    function animate(startTime: number, now: number): void {
      const elapsed = now - startTime;
      const fallT = Math.min(elapsed / TBC_FALL_DURATION_MS, 1);
      const lemmingY = -lemmingSize + fallT * (holeY + lemmingSize);
      const scrollT = Math.min(Math.max(elapsed - TBC_FALL_DURATION_MS, 0) / TBC_SCROLL_DURATION_MS, 1);
      /* easeInOutQuart: accelerate into the dark, brake into the final frame */
      const eased = scrollT < 0.5
        ? 8 * scrollT ** 4
        : 1 - (-2 * scrollT + 2) ** 4 / 2;
      const scrollY = eased * SCROLL_DISTANCE;
      const restT = Math.min(Math.max(elapsed - TBC_FALL_DURATION_MS - TBC_SCROLL_DURATION_MS, 0) / TBC_REST_FADE_MS, 1);
      /* Arrive in pure dark, then let the hint fragments emerge (easeOutQuad) */
      const veilAlpha = scrollT < 1 ? 0 : 0.8 * (1 - restT * (2 - restT));
      drawScene(lemmingY, scrollY, veilAlpha);
      if (scrollT >= 0.45) screen.querySelector('.tbc-overlay')?.classList.add('show');
      if (elapsed < TBC_FALL_DURATION_MS + TBC_SCROLL_DURATION_MS + TBC_REST_FADE_MS) {
        requestAnimationFrame((n) => animate(startTime, n));
      }
    }

    /* The game-over timer arms only once the animation starts, so a slow image
       load can't tear the screen down mid-scroll */
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      requestAnimationFrame((now) => animate(now, now));
      setTimeout(() => createGameOverScreen(score), TBC_TRANSITION_MS);
    };
    let pendingImgs = [undergroundImg].filter((img) => !img.complete);
    const onImgSettled = (img: HTMLImageElement) => {
      pendingImgs = pendingImgs.filter((i) => i !== img);
      if (pendingImgs.length === 0) start();
    };
    if (pendingImgs.length === 0) start();
    else pendingImgs.forEach((img) => {
      /* 'error' counts as settled too — drawScene guards per image, and a missing
         layer must not stall the whole transition */
      img.addEventListener('load', () => onImgSettled(img), { once: true });
      img.addEventListener('error', () => onImgSettled(img), { once: true });
    });
  }

  function createGameOverScreen(score: number): void {
    const size = getCanvasSize();
    const gameOverScreen = buildDom(`
      <section class="section-container game-over-screen">
        <div class="crt-frame">
          <canvas class="game-over-canvas" aria-hidden="true"></canvas>
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

    const title = gameOverScreen.querySelector('.go-title') as HTMLElement;
    title.tabIndex = -1;
    title.focus();

    const startRankingMusic = (): void => {
      if (!mainElement.querySelector('.game-over-screen, .ranking-screen')) return;
      rankingMusic = new Audio(RANKING_MUSIC);
      rankingMusic.loop = true;
      rankingMusic.muted = localStorage.getItem('audio-muted') === '1';
      /* The die SFX can finish while the tab is hidden — start paused and
         let the visibility listener resume on return */
      if (!document.hidden) safePlay(rankingMusic);
    };

    if (localStorage.getItem('audio-muted') !== '1') {
      const dieSfx = new Audio(DIE_SFX);
      dieSfx.addEventListener('ended', startRankingMusic);
      safePlay(dieSfx);
    } else {
      startRankingMusic();
    }

    const submission: Promise<SubmissionResult> = debugScreen
      ? Promise.resolve({ error: false, docId: null, bestScore: null })
      : submitScore(playerName, score)
        .then(({ docId, bestScore }) => ({ error: false, docId, bestScore }))
        .catch(() => ({ error: true, docId: null, bestScore: null }));

    setTimeout(() => createRankingScreen(score, submission), GAME_OVER_TRANSITION_MS);
  }

  function createRankingScreen(currentScore: number, submission: Promise<SubmissionResult>): void {
    const size = getCanvasSize();
    buildDom(`
      <section class="section-container ranking-screen">
        <div class="crt-frame">
          <canvas class="ranking-canvas" aria-hidden="true"></canvas>
          <div class="ranking-overlay">
            <h1 class="ranking-title">Hall of Fame</h1>
            <div class="ranking-list">
              <p class="ranking-loading">&gt; loading...</p>
            </div>
            <button class="splash-start ranking-play-again">Play again</button>
          </div>
          <button class="mute-btn" aria-label="Mute sound"></button>
        </div>
      </section>
    `);

    const canvas = mainElement.querySelector('.ranking-canvas') as HTMLCanvasElement;
    canvas.width = size;
    canvas.height = size;

    setupMuteButton(
      mainElement.querySelector('.mute-btn') as HTMLButtonElement,
      (muted) => { if (rankingMusic) rankingMusic.muted = muted; },
    );

    const playAgainBtn = mainElement.querySelector('.ranking-play-again') as HTMLButtonElement;
    playAgainBtn.focus();
    playAgainBtn.addEventListener('click', () => {
      if (rankingMusic) {
        rankingMusic.pause();
        rankingMusic.src = '';
        rankingMusic = null;
      }
      createStartScreen();
    });

    loadRanking(currentScore, submission);
  }

  async function loadRanking(currentScore: number, submission: Promise<SubmissionResult>): Promise<void> {
    const listEl = mainElement.querySelector('.ranking-list');
    if (!listEl) return;

    /* Bounded wait for the submission; falls back to failed if still pending */
    const resolveSubmission = (): Promise<SubmissionResult> =>
      Promise.race([
        submission,
        new Promise<SubmissionResult>((resolve) =>
          setTimeout(() => resolve({ error: true, docId: null, bestScore: null }), SUBMISSION_TIMEOUT_MS)
        ),
      ]);

    function showSaveErrorBanner(): void {
      if (mainElement.querySelector('.ranking-save-error')) return;
      const overlay = mainElement.querySelector('.ranking-overlay');
      const title = overlay?.querySelector('.ranking-title');
      if (!overlay || !title) return;
      const banner = document.createElement('p');
      banner.className = 'ranking-save-error';
      banner.textContent = '> score could not be saved.';
      overlay.insertBefore(banner, title);
    }

    try {
      const scores = await fetchTopScores(10);
      if (!mainElement.querySelector('.ranking-list')) return; // navigated away
      const { error: submissionError, docId: submittedDocId, bestScore } = await resolveSubmission();
      if (!mainElement.querySelector('.ranking-list')) return;
      if (submissionError) showSaveErrorBanner();

      if (scores.length === 0) {
        listEl.innerHTML = '<p class="ranking-empty">&gt; no scores yet — be the first!</p>';
        return;
      }

      /* The leaderboard keeps one record per name (the personal best), so a name
         match means this row IS the player's entry — highlight it in place and
         never append a duplicate row with this run's lower score below */
      const isPlayerRow = (s: { id: string; name: string }): boolean =>
        (submittedDocId !== null && s.id === submittedDocId)
        || (playerName !== '' && s.name === playerName);
      const playerInTop10 = scores.some(isPlayerRow);

      let html = '<ol class="ranking-table">';
      let displayRank = 1;
      scores.forEach((s, i) => {
        if (i > 0 && s.score < scores[i - 1].score) displayRank = i + 1;
        const isCurrent = isPlayerRow(s);
        html += `<li class="ranking-row${isCurrent ? ' ranking-row--current' : ''}">
          <span class="ranking-rank">${displayRank}.</span>
          <span class="ranking-name">${escapeHtml(s.name)}</span>
          <span class="ranking-score">${s.score}s</span>
        </li>`;
      });
      html += '</ol>';

      if (!playerInTop10) {
        const effectiveScore = bestScore ?? currentScore;
        const rank = await getPlayerRank(effectiveScore).catch(() => null);
        if (!mainElement.querySelector('.ranking-list')) return;
        if (rank !== null) {
          html += `
            <hr class="ranking-divider">
            ${rank > 10 ? '<p class="ranking-not-top10">&gt; you are still not in the top 10</p>' : ''}
            <div class="ranking-row ranking-row--current">
              <span class="ranking-rank">${rank}.</span>
              <span class="ranking-name">${escapeHtml(playerName)}</span>
              <span class="ranking-score">${effectiveScore}s</span>
            </div>
          `;
        }
      }

      listEl.innerHTML = html;
    } catch {
      if (!mainElement.querySelector('.ranking-list')) return;
      const { error: submissionError } = await resolveSubmission();
      if (!mainElement.querySelector('.ranking-list')) return;
      if (submissionError) showSaveErrorBanner();
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

  if (debugScreen === 'tbc') createToBeContinuedScreen(42);
  else createStartScreen();
}

window.addEventListener('load', main);
