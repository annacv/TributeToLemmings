import { prefersReducedMotion } from '../lib/fx';
import { isMuted, safePlay } from '../lib/audio';
import { getDebugScreen } from '../lib/debugScreen';
import { announce } from '../lib/liveRegion';
import { submitScore } from '../lib/leaderboard';
import { breakdownLines, type ScoreBreakdown } from '../lib/score';
import { COUNT_CHIME_SFX, COUNT_TICK_SFX, DIE_SFX } from '../assets';
import type { AppContext, ScreenRoutes, SubmissionResult } from '../lib/appContext';

const GAME_OVER_TRANSITION_MS = 2000;
const GAME_OVER_COUNT_HOLD_MS = 5000;
export function createGameOverScreen(
  ctx: AppContext,
  routes: ScreenRoutes,
  breakdown: ScoreBreakdown,
  variant: 'death' | 'win' = 'death',
): void {
  const reduceMotion = prefersReducedMotion();
  const countLines = breakdownLines(breakdown).filter((line) => line.value > 0);
  const hasCount = breakdown.tunnelTime + breakdown.abyssTime + breakdown.stalactiteBonus + breakdown.levelsBonus > 0;
  const isWin = variant === 'win';

  const canvasHtml = isWin
    ? '<div class="win-canvas" aria-hidden="true"></div>'
    : '<div class="game-over-canvas" aria-hidden="true"></div>';

  const headingHtml = isWin
    ? '<p class="go-boom">CONGRATS!!!</p><h1 class="go-title">&gt; You made it!</h1>'
    : '<p class="go-boom">BOOOM!!!</p><h1 class="go-title">GAME OVER</h1>';

  const screen = ctx.buildDom(`
      <section class="section-container game-over-screen">
        <div class="game-stage">
          ${canvasHtml}
          <div class="game-over-overlay">
            ${headingHtml}
            ${hasCount ? '<ul class="go-count"></ul>' : ''}
            <p class="go-score">score <span class="go-score-value"></span></p>
          </div>
        </div>
      </section>
    `);

  const title = screen.querySelector('.go-title') as HTMLElement;
  title.tabIndex = -1;
  title.focus();

  const startRankingMusic = (): void => {
    ctx.rankingMusic.startOnGameOver(ctx.root);
  };

  ctx.rankingMusic.stop();

  const muted = isMuted();
  const playOptionalSfx = (src: string): void => {
    if (!muted) safePlay(new Audio(src));
  };

  const score = screen.querySelector('.go-score-value');
  const countList = screen.querySelector('.go-count');

  if (hasCount && countList && score) {
    const lineEls = countLines.map(({ label, rule, value }) => {
      const li = document.createElement('li');
      li.className = 'go-count-line';
      li.innerHTML = `<span class="go-count-label">${label}</span><span class="go-count-rule">${rule}</span><span class="go-count-value">${value}</span>`;
      countList.appendChild(li);
      return li;
    });

    if (reduceMotion) {
      lineEls.forEach((li) => li.classList.add('show'));
      score.textContent = String(breakdown.total);
      announce(`Score: ${breakdown.total}`);
    } else {
      score.textContent = '0';
      lineEls.forEach((li, i) => setTimeout(() => {
        li.classList.add('show');
        playOptionalSfx(COUNT_TICK_SFX);
      }, 300 + i * 250));

      const rollStartMs = 300 + lineEls.length * 250;
      const ROLL_MS = 500;

      setTimeout(() => {
        playOptionalSfx(COUNT_CHIME_SFX);
        const rollTimer = setInterval(() => {
          if (!ctx.root.contains(score)) { clearInterval(rollTimer); return; }
          const next = Math.min(breakdown.total, Number(score.textContent) + Math.ceil(breakdown.total / (ROLL_MS / 40)));
          score.textContent = String(next);
          if (next >= breakdown.total) {
            clearInterval(rollTimer);
            announce(`Score: ${breakdown.total}`); // settled total, once the roll lands
          }
        }, 40);
      }, rollStartMs);
    }
  } else if (score) {
    score.textContent = String(breakdown.total);
    announce(`Score: ${breakdown.total}`);
  }

  if (variant === 'death' && !muted) {
    const dieSfx = new Audio(DIE_SFX);
    dieSfx.addEventListener('ended', startRankingMusic);
    safePlay(dieSfx);
  } else if (variant === 'death') {
    startRankingMusic();
  }

  /* Only the total reaches the leaderboard; the breakdown stays client-side */
  const submission: Promise<SubmissionResult> = getDebugScreen()
    ? Promise.resolve({ error: false, docId: null, bestScore: null })
    : submitScore(ctx.getPlayerName(), breakdown.total)
      .then(({ docId, bestScore }) => ({ error: false, docId, bestScore }))
      .catch(() => ({ error: true, docId: null, bestScore: null }));

  /* Hold the breakdown long enough to read it; surface-only deaths (no count) keep today's short beat. */
  const holdMs = hasCount && !reduceMotion ? GAME_OVER_COUNT_HOLD_MS : GAME_OVER_TRANSITION_MS;
  setTimeout(() => {
    if (isWin) routes.createTheEndScreen(breakdown, submission);
    else routes.createRankingScreen(breakdown.total, submission);
  }, holdMs);
}
