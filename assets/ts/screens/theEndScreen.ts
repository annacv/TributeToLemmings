import { prefersReducedMotion } from '../lib/fx';
import { isMuted, safePlay, playLoop, stopLoop, pauseWhileHidden } from '../lib/audio';
import { getCanvasSize, LEMMING_SIZE_FRAC } from '../lib/geometry';
import { loadImage, whenImagesSettled } from '../lib/images';
import { setupMuteButton } from '../lib/muteButton';
import {
  THE_END_ASCEND_MS, THE_END_BOARD_MS, THE_END_CREDITS_START_MS,
  THE_END_END_HOLD_MS, THE_END_PROMPT_HINT_VISIBLE_MS,
  THE_END_PROMPT_HOLD_MS, THE_END_PROMPT_HOLD_MS_MOBILE, THE_END_WALK_MS,
  theEndCreditsScroll, theEndFrameAt, type TheEndConfig,
} from '../worlds/theEnd/TheEndScene';
import { drawTheEndScene } from '../worlds/theEnd/TheEndRenderer';
import { BALLOON_SVG, BALLOON_SFX, THE_END_BACKGROUND_SVG, THE_END_MUSIC } from '../assets';
import type { ScoreBreakdown } from '../lib/score';
import type { AppContext, ScreenRoutes, SubmissionResult } from '../lib/appContext';

const THE_END_BALLOON_WIDTH_FRAC = 0.34;
const THE_END_GROUND_Y_FRAC = 0.86;
const THE_END_BALLOON_X_FRAC = 0.62;
const THE_END_WALK_START_X_FRAC = 0.18;
const THE_END_WALK_END_INSET_FRAC = 0.16;

const CREDITS_HTML = `<p class="the-end-credit the-end-credit--copy">THE END

Tribute to Lemmings is a loving nod to the original DMA Design's Lemmings game (1991)

Music — Lemmings DOS OST
SFX — Lemmings DOS set

Made with fun by Anna Condal</p>`;

export function createTheEndScreen(
  ctx: AppContext,
  routes: ScreenRoutes,
  breakdown: ScoreBreakdown,
  submission: Promise<SubmissionResult>,
): void {
  const size = getCanvasSize();
  const reduceMotion = prefersReducedMotion();
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  const muted = isMuted();
  const promptHoldMs = isMobile ? THE_END_PROMPT_HOLD_MS_MOBILE : THE_END_PROMPT_HOLD_MS;

  const screen = ctx.buildDom(`
      <section class="section-container the-end-screen">
        <div class="game-stage">
          <canvas class="the-end-canvas" aria-hidden="true"></canvas>
          <div class="the-end-credits" aria-hidden="true"><div class="the-end-credits-roll">${CREDITS_HTML}</div></div>
          <div class="the-end-overlay">
            <p class="the-end-prompt">
              <span class="the-end-prompt-desktop">Press <kbd class="key-hint-text">SPACE</kbd> to lift off</span>
              <span class="the-end-prompt-mobile">Tap to lift off</span>
            </p>
          </div>
          <button class="the-end-skip" aria-label="Skip to ranking">Skip &gt;&gt;</button>
          <button class="mute-btn" aria-label="Mute sound"></button>
        </div>
      </section>
    `);

  const canvas = screen.querySelector('.the-end-canvas') as HTMLCanvasElement;
  canvas.width = size;
  canvas.height = size;
  const ctx2d = canvas.getContext('2d')!;
  const prompt = screen.querySelector('.the-end-prompt') as HTMLElement;
  const credits = screen.querySelector('.the-end-credits') as HTMLElement;
  const creditsRoll = credits.querySelector('.the-end-credits-roll') as HTMLElement;
  prompt.tabIndex = -1;
  prompt.focus();

  const sceneImg = loadImage(THE_END_BACKGROUND_SVG);
  const balloonImg = loadImage(BALLOON_SVG);

  const balloonW = size * THE_END_BALLOON_WIDTH_FRAC;
  const config: TheEndConfig = {
    size,
    groundY: size * THE_END_GROUND_Y_FRAC,
    balloonX: size * THE_END_BALLOON_X_FRAC,
    balloonW,
    lemmingSize: size * LEMMING_SIZE_FRAC,
    walkStartX: size * THE_END_WALK_START_X_FRAC,
    walkEndX: size * THE_END_BALLOON_X_FRAC - balloonW * THE_END_WALK_END_INSET_FRAC,
  };
  const durations = { walkMs: THE_END_WALK_MS, boardMs: THE_END_BOARD_MS, ascendMs: THE_END_ASCEND_MS };

  const controller = new AbortController();
  const music = new Audio(THE_END_MUSIC);
  let startTime = performance.now();
  let liftOffElapsed: number | null = null;
  let promptReadyAt: number | null = null;
  let routed = false;
  let creditsRouteTimer: ReturnType<typeof setTimeout> | null = null;

  function canLiftOff(): boolean {
    if (liftOffElapsed !== null || routed) return false;
    const frame = theEndFrameAt(performance.now() - startTime, liftOffElapsed, durations, config);
    if (frame.phase !== 'prompt') return false;
    if (!isMobile) return true;
    return promptReadyAt !== null
      && performance.now() - promptReadyAt >= THE_END_PROMPT_HINT_VISIBLE_MS;
  }

  function startCredits(): void {
    if (routed) return;
    credits.classList.add('the-end-credits--roll');
    requestAnimationFrame(() => {
      if (routed) return;
      const { ms, endPct } = theEndCreditsScroll(creditsRoll.offsetHeight, size);
      creditsRoll.style.setProperty('--the-end-credits-duration', `${ms}ms`);
      creditsRoll.style.setProperty('--the-end-credits-scroll-end', `${endPct}%`);
      creditsRoll.classList.add('the-end-credits-roll--scrolling');
      creditsRouteTimer = setTimeout(route, ms);
    });
  }

  function doLiftOff(): void {
    if (liftOffElapsed !== null || routed) return;
    liftOffElapsed = performance.now() - startTime;
    prompt.classList.remove('show');
    setTimeout(() => { if (!routed && !muted) safePlay(new Audio(BALLOON_SFX)); }, THE_END_BOARD_MS);
    setTimeout(startCredits, THE_END_CREDITS_START_MS);
  }

  function route(): void {
    if (routed) return;
    routed = true;
    if (creditsRouteTimer !== null) clearTimeout(creditsRouteTimer);
    controller.abort();
    stopLoop(music);
    routes.createRankingScreen(breakdown.total, submission);
  }

  function draw(): void {
    if (routed) return;
    const frame = theEndFrameAt(performance.now() - startTime, liftOffElapsed, durations, config);
    if (frame.phase === 'prompt' && promptReadyAt === null) promptReadyAt = performance.now();
    prompt.classList.toggle('show', frame.phase === 'prompt');
    drawTheEndScene(ctx2d, size, frame, sceneImg, balloonImg);
    requestAnimationFrame(draw);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (liftOffElapsed === null) { if (canLiftOff()) doLiftOff(); }
      else route();
    }
  }, { signal: controller.signal });
  canvas.addEventListener('pointerdown', () => { if (canLiftOff()) doLiftOff(); }, { signal: controller.signal });
  (screen.querySelector('.the-end-skip') as HTMLButtonElement)
    .addEventListener('click', route, { signal: controller.signal });

  playLoop(music, muted);
  pauseWhileHidden(music, { signal: controller.signal, shouldResume: () => !routed });
  setupMuteButton(
    screen.querySelector('.mute-btn') as HTMLButtonElement,
    (m) => { music.muted = m; },
  );

  if (reduceMotion) {
    liftOffElapsed = 0;
    const endFrame = theEndFrameAt(THE_END_BOARD_MS + THE_END_ASCEND_MS, 0, durations, config);
    credits.classList.add('the-end-credits--static');
    if (!muted) safePlay(new Audio(BALLOON_SFX));
    setTimeout(route, THE_END_END_HOLD_MS);
    const drawEndState = (): void => {
      if (!routed) drawTheEndScene(ctx2d, size, endFrame, sceneImg, balloonImg);
    };
    drawEndState();
    whenImagesSettled([sceneImg, balloonImg], drawEndState);
    return;
  }

  setTimeout(doLiftOff, THE_END_WALK_MS + promptHoldMs);
  requestAnimationFrame(draw);
}
