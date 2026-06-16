import { SurfaceGame } from './SurfaceGame';
import { TunnelGame } from './TunnelGame';
import { drawLemmingMascot, drawLemmingShape } from './Player';
import { submitScore, fetchTopScores, getPlayerRank, preloadLeaderboard } from './lib/leaderboard';
import { safePlay, playLoop, pauseWhileHidden } from './lib/audio';
import { getCanvasSize, LEMMING_SIZE_FRAC, TRANSITION_GEOMETRY } from './lib/geometry';
import { getDebugScreen, consumeDebugScreen } from './lib/debugScreen';
import { loadImage } from './lib/images';
import { makeBreakdown, breakdownLines, type ScoreBreakdown } from './lib/score';
import {
  DIE_SFX, RANKING_MUSIC, FALLING_SFX, CAVE_LOOP,
  COUNT_TICK_SFX, COUNT_CHIME_SFX, UNDERGROUND_BACKGROUND_SVG, UNDERGROUND_ABYSS_BACKGROUND_SVG,
} from './assets';

type SubmissionResult = { error: boolean; docId: string | null; bestScore: number | null };
type InfoModalOptions = { screenName: string; title: string; bodyHtml: string; storageKey: string };

const GAME_OVER_TRANSITION_MS = 2000;
const GAME_OVER_COUNT_HOLD_MS = 4200;
const SUBMISSION_TIMEOUT_MS = 2500;
const TRANSITION_FALL_DURATION_MS = 500;
const TRANSITION_SCROLL_DURATION_MS = 1700;
const TRANSITION_REST_FADE_MS = 500;
const TRANSITION_TOTAL_MS = 3000;
const TRANSITION_BREATH_MS = 600;
const TRANSITION_MESSAGE_AT_REST = 1;
const TRANSITION_MESSAGE_FROM_START = 0.0125;

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

  document.addEventListener('visibilitychange', () => {
    if (!rankingMusic) return;
    if (document.hidden) rankingMusic.pause();
    else safePlay(rankingMusic);
  });

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

  /* INFO MODALS */

  const SURFACE_MODAL: InfoModalOptions = {
    screenName: 'The Surface',
    title: 'How to play',
    storageKey: 'surface-modal-dismissed',
    bodyHtml: `
        <p class="info-modal-instruction">
          Use <kbd class="key-hint">&#x2190;</kbd> <kbd class="key-hint">&#x2192;</kbd> arrow keys<br>
          to dodge the bombs and stay alive!
        </p>`,
  };

  const TUNNEL_MODAL: InfoModalOptions = {
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

  function showInfoModal(opts: InfoModalOptions, onClose: () => void): void {
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

  /* SCREENS */
  
  function createStartScreen(): void {
    buildDom(`
      <section class="splash-hero">
        <canvas class="splash-mascot" role="img" aria-label="Lemming mascot"></canvas>
        <h1 class="splash-title">Tribute to<br>Lemmings</h1>
        <p class="splash-tagline">&gt; skip and escape. stay alive!</p>
        <form class="splash-form">
          <div class="splash-name-wrap">
            <input
              id="splash-name-input"
              class="splash-name-input"
              type="text"
              maxlength="27"
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

    const game = new SurfaceGame(canvas);
    game.gameOverCallback(createGameOverScreen);
    game.tunnelWorldCallback(createTransitionScreen);

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

    showInfoModal(SURFACE_MODAL, () => {
      canvas.focus();
      game.startGame();
    });
  }

  /* The collapse-shaft fall transition. Default: surface→tunnel (lands in the
     tunnel). Reused for tunnel→Abyss by passing the warm stinger, the descent art
     that reddens into the Abyss, and the win-screen arrival (see the tunnel
     completion callback). */
  function createTransitionScreen(
    breakdown: ScoreBreakdown,
    stingerHtml = '&gt; somewhere underground...',
    onArrive: (b: ScoreBreakdown) => void = createTunnelScreen,
    backgroundSvg: string = UNDERGROUND_BACKGROUND_SVG,
    messageScrollT = TRANSITION_MESSAGE_AT_REST,
  ): void {
    const size = getCanvasSize();
    const screen = buildDom(`
      <section class="section-container to-be-continued-screen">
        <div class="crt-frame">
          <canvas class="transition-canvas" aria-hidden="true"></canvas>
          <div class="transition-overlay">
            <p class="transition-line">${stingerHtml}</p>
          </div>
        </div>
      </section>
    `);

    const canvas = screen.querySelector('.transition-canvas') as HTMLCanvasElement;
    canvas.width = size;
    canvas.height = size;
    /* Focus visible content, never the aria-hidden canvas */
    const overlay = screen.querySelector('.transition-overlay') as HTMLElement;
    overlay.tabIndex = -1;
    overlay.focus();
    const ctx = canvas.getContext('2d')!;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const undergroundImg = loadImage(backgroundSvg);

    if (localStorage.getItem('audio-muted') !== '1') {
      safePlay(new Audio(FALLING_SFX));
    }

    const lemmingSize = size * LEMMING_SIZE_FRAC;
    const bgSize = size * TRANSITION_GEOMETRY.BG_ZOOM;
    const surfaceBottomY = bgSize * (1 - TRANSITION_GEOMETRY.BG_CROP_TOP_FRAC);
    /* Mirrors the shaft geometry baked into background-underground.svg so the
       lemming lands in row 0's hole */
    const erosionFrameW = size * TRANSITION_GEOMETRY.EROSION_SLOT_WIDTH_FRAC;
    const erosionFrameH = erosionFrameW * TRANSITION_GEOMETRY.GROUND_EROSION_ASPECT;
    const erosionStackTop = size * TRANSITION_GEOMETRY.EROSION_STACK_TOP_FRAC;
    const SCROLL_DISTANCE = surfaceBottomY + 2 * size;
    const holeCenterY = erosionStackTop + erosionFrameH * TRANSITION_GEOMETRY.HOLE_CENTER_Y_FRAC;
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
      const fallT = Math.min(elapsed / TRANSITION_FALL_DURATION_MS, 1);
      const lemmingY = -lemmingSize + fallT * (holeY + lemmingSize);
      const scrollT = Math.min(Math.max(elapsed - TRANSITION_FALL_DURATION_MS, 0) / TRANSITION_SCROLL_DURATION_MS, 1);
      /* easeInOutQuart: accelerate into the dark, brake into the final frame */
      const eased = scrollT < 0.5
        ? 8 * scrollT ** 4
        : 1 - (-2 * scrollT + 2) ** 4 / 2;
      const scrollY = eased * SCROLL_DISTANCE;
      const restT = Math.min(Math.max(elapsed - TRANSITION_FALL_DURATION_MS - TRANSITION_SCROLL_DURATION_MS, 0) / TRANSITION_REST_FADE_MS, 1);
      /* Arrive in pure dark, then let the hint fragments emerge (easeOutQuad) */
      const veilAlpha = scrollT < 1 ? 0 : 0.8 * (1 - restT * (2 - restT));
      drawScene(lemmingY, scrollY, veilAlpha);
      /* The stinger fades in at its reveal point: at rest for surface→tunnel (no
         mid-scroll cliffhanger), early for the Abyss handoff (before the reveal) */
      if (scrollT >= messageScrollT) screen.querySelector('.transition-overlay')?.classList.add('show');
      if (elapsed < TRANSITION_FALL_DURATION_MS + TRANSITION_SCROLL_DURATION_MS + TRANSITION_REST_FADE_MS) {
        requestAnimationFrame((n) => animate(startTime, n));
      }
    }

    /* The handoff timer arms only once the animation starts, so a slow image
       load can't tear the screen down mid-scroll */
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      /* Reduced motion: jump straight to the resting frame — the rest-beat
         fade and the timing of the subsequent beats still resolve */
      const skipMs = reduceMotion ? TRANSITION_FALL_DURATION_MS + TRANSITION_SCROLL_DURATION_MS : 0;
      requestAnimationFrame((now) => animate(now - skipMs, now));
      /* The arrival routes into the tunnel after a short breath; the breakdown
         passes onward unchanged (surface + surface levels bonus already applied) */
      setTimeout(() => onArrive(breakdown), TRANSITION_TOTAL_MS + TRANSITION_BREATH_MS);
    };
    let pendingImgs = [undergroundImg].filter((img) => !img.complete);
    const onImgSettled = (img: HTMLImageElement) => {
      pendingImgs = pendingImgs.filter((i) => i !== img);
      if (pendingImgs.length === 0) start();
    };
    if (pendingImgs.length === 0) start();
    else pendingImgs.forEach((img) => {
      img.addEventListener('load', () => onImgSettled(img), { once: true });
      img.addEventListener('error', () => onImgSettled(img), { once: true });
    });
  }

  function createTunnelScreen(breakdown: ScoreBreakdown): void {
    const size = getCanvasSize();
    const screen = buildDom(`
      <section class="section-container play">
        <div class="crt-frame">
          <canvas class="tunnel-game-canvas" role="img" aria-label="Tunnel — find the crack and blast your way out"></canvas>
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
                <span class="hud-value seconds-value">60</span>
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
          <button class="touch-action" aria-label="Action">SPACE</button>
          <button class="touch-right" aria-label="Move right">&#x2192;</button>
        </div>
        <p class="game-hint">&gt; Find the crack. Blast your way out!</p>
      </section>
    `);

    const canvas = screen.querySelector('canvas') as HTMLCanvasElement;
    canvas.width = size;
    canvas.height = size;

    const game = new TunnelGame(canvas, breakdown);
    game.completionCallback((b) => createTransitionScreen(
      b,
      '&gt; the air grows warm...',
      (bb) => createGameOverScreen(bb, 'win'),
      UNDERGROUND_ABYSS_BACKGROUND_SVG,
      TRANSITION_MESSAGE_FROM_START,
    ));
    game.gameOverCallback(createGameOverScreen);

    /* Cave loop through the channel helper: respects the mute gate, pauses
       with the hidden tab, dies with the run */
    const caveLoop = new Audio(CAVE_LOOP);
    game.caveLoop = caveLoop;
    playLoop(caveLoop, game.muted);
    pauseWhileHidden(caveLoop, { signal: game.runSignal, shouldResume: () => !game.isOver });

    setupMuteButton(
      screen.querySelector('.mute-btn') as HTMLButtonElement,
      (muted) => { game.muted = muted; caveLoop.muted = muted; },
    );

    /* One verb per state: Space (or the action button) is pick up / place /
       light; auto-repeat is ignored and a focused control never activates */
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (game.paused) return;
      if (event.key === 'ArrowRight') game.player?.setDirection(1);
      else if (event.key === 'ArrowLeft') game.player?.setDirection(-1);
      else if (event.key === ' ') {
        event.preventDefault();
        if (event.repeat) return;
        game.action();
      }
    }, { signal: game.runSignal });

    const arrowRight = screen.querySelector('.touch-right') as HTMLElement;
    arrowRight.addEventListener('touchstart', () => game.player?.setDirection(1));
    arrowRight.addEventListener('click', () => game.player?.setDirection(1));
    
    const arrowLeft = screen.querySelector('.touch-left') as HTMLElement;
    arrowLeft.addEventListener('touchstart', () => game.player?.setDirection(-1));
    arrowLeft.addEventListener('click', () => game.player?.setDirection(-1));

    const actionBtn = screen.querySelector('.touch-action') as HTMLButtonElement;
    actionBtn.addEventListener('click', () => game.action());

    canvas.tabIndex = -1;
    game.paused = true;

    showInfoModal(TUNNEL_MODAL, () => {
      game.paused = false;
      canvas.focus();
      game.startGame();
    });
  }

  function createGameOverScreen(breakdown: ScoreBreakdown, variant: 'death' | 'win' = 'death'): void {
    const size = getCanvasSize();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const countLines = breakdownLines(breakdown).filter((line) => line.value > 0);

    const hasCount = breakdown.tunnelTime + breakdown.levelsBonus > 0;

    const gameOverScreen = buildDom(`
      <section class="section-container game-over-screen">
        <div class="crt-frame">
        ${variant === 'win' ? 
          '<canvas class="win-tunnel-canvas" aria-hidden="true"></canvas>' :
          '<canvas class="game-over-canvas" aria-hidden="true"></canvas>'}
          <div class="game-over-overlay">
            ${variant === 'win' ? 
              '<h1 class="go-title">&gt; You made it!<br>For now...</h1>' : 
              '<p class="go-boom">BOOOM!!!</p>' + '<h1 class="go-title">GAME OVER</h1>'}
            ${hasCount ? '<ul class="go-count"></ul>' : ''}
            <p class="go-score">score <span class="go-score-value"></span></p>
          </div>
        </div>
      </section>
    `);

    const canvas = gameOverScreen.querySelector('.game-over-canvas, .win-tunnel-canvas') as HTMLCanvasElement | null;
    if (canvas) {
      canvas.width = size;
      canvas.height = size;
    }

    const title = gameOverScreen.querySelector('.go-title') as HTMLElement;
    title.tabIndex = -1;
    title.focus();

    const startRankingMusic = (): void => {
      if (!mainElement.querySelector('.game-over-screen, .ranking-screen')) return;
      if (rankingMusic) return;
      rankingMusic = new Audio(RANKING_MUSIC);
      rankingMusic.loop = true;
      rankingMusic.muted = localStorage.getItem('audio-muted') === '1';
      /* The arrival SFX can finish while the tab is hidden — start paused and
         let the visibility listener resume on return */
      if (!document.hidden) safePlay(rankingMusic);
    };
    if (rankingMusic) {
      rankingMusic.pause();
      rankingMusic = null;
    }

    const muted = localStorage.getItem('audio-muted') === '1';
    const playOptionalSfx = (src: string | null): void => {
      if (src && !muted) safePlay(new Audio(src));
    };

    const scoreEl = gameOverScreen.querySelector('.go-score-value');
    const countList = gameOverScreen.querySelector('.go-count');
    let countDoneMs = 0;

    if (hasCount && countList && scoreEl) {
      const lineEls = countLines.map(({ label, rule, value }) => {
        const li = document.createElement('li');
        li.className = 'go-count-line';
        li.innerHTML = `<span class="go-count-label">${label}</span><span class="go-count-rule">${rule}</span><span class="go-count-value">${value}</span>`;
        countList.appendChild(li);
        return li;
      });

      if (reduceMotion) {
        lineEls.forEach((li) => li.classList.add('show'));
        scoreEl.textContent = String(breakdown.total);
      } else {
        scoreEl.textContent = '0';
        lineEls.forEach((li, i) => setTimeout(() => {
          li.classList.add('show');
          playOptionalSfx(COUNT_TICK_SFX);
        }, 300 + i * 250));
        
        const rollStartMs = 300 + lineEls.length * 250;
        const ROLL_MS = 500;

        setTimeout(() => {
          playOptionalSfx(COUNT_CHIME_SFX);
          const rollTimer = setInterval(() => {
            if (!mainElement.contains(scoreEl)) { clearInterval(rollTimer); return; }
            const next = Math.min(breakdown.total, Number(scoreEl.textContent) + Math.ceil(breakdown.total / (ROLL_MS / 40)));
            scoreEl.textContent = String(next);
            if (next >= breakdown.total) clearInterval(rollTimer);
          }, 40);
        }, rollStartMs);

        countDoneMs = rollStartMs + ROLL_MS;
      }
    } else if (scoreEl) {
      scoreEl.textContent = String(breakdown.total);
    }

    if (variant === 'death' && !muted) {
      const dieSfx = new Audio(DIE_SFX);
      dieSfx.addEventListener('ended', startRankingMusic);
      safePlay(dieSfx);
    } else if (variant === 'death') {
      startRankingMusic();
    } else {
      /* Win: no death knell — ranking music starts from the count completion */
      setTimeout(startRankingMusic, countDoneMs);
    }

    /* Only the total reaches the leaderboard; the breakdown stays client-side */
    const submission: Promise<SubmissionResult> = getDebugScreen()
      ? Promise.resolve({ error: false, docId: null, bestScore: null })
      : submitScore(playerName, breakdown.total)
        .then(({ docId, bestScore }) => ({ error: false, docId, bestScore }))
        .catch(() => ({ error: true, docId: null, bestScore: null }));

    /* The hold extends to let the count land; surface-only deaths keep today's beat */
    const holdMs = hasCount && !reduceMotion ? GAME_OVER_COUNT_HOLD_MS : GAME_OVER_TRANSITION_MS;
    setTimeout(() => createRankingScreen(breakdown.total, submission), holdMs);
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
      /* Bounded fetch (mirrors resolveSubmission): an unreachable Firestore
         surfaces the error/retry UI instead of an indefinite loading state */
      const scores = await Promise.race([
        fetchTopScores(10),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('leaderboard fetch timeout')), SUBMISSION_TIMEOUT_MS)
        ),
      ]);

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
          <span class="ranking-score">${s.score}</span>
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
              <span class="ranking-score">${effectiveScore}</span>
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

  const debugScreen = getDebugScreen();
  if (debugScreen === 'transition') createTransitionScreen(makeBreakdown({ surfaceTime: 42 }));
  else if (debugScreen === 'tunnel') createTunnelScreen(makeBreakdown({ surfaceTime: 42, levelsBonus: 15 }));
  else createStartScreen();
}

window.addEventListener('load', main);
