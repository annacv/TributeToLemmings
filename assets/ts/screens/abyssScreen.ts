import { AbyssGame } from '../worlds/abyss/AbyssGame';
import { buildPlayScreen } from '../lib/playScreen';
import { attachWorldLoop } from '../lib/attachWorldLoop';
import { ABYSS_MODAL, showInfoModal } from '../lib/infoModal';
import { ABYSS_LOOP, SPRITES, STALACTITE_SVGS } from '../assets';
import type { ScoreBreakdown } from '../lib/score';
import type { AppContext, ScreenRoutes } from '../lib/appContext';

export function createAbyssScreen(ctx: AppContext, routes: ScreenRoutes, breakdown: ScoreBreakdown): void {
  const { canvas, wireMovement, wireAction, wireMute } = buildPlayScreen(ctx.root, {
    canvasClass: 'abyss-game-canvas',
    canvasAriaLabel: 'The Abyss — gather bombs and bring down the stalactites',
    secondsStart: 72,
    withAction: true,
  });

  const game = new AbyssGame(
    canvas,
    breakdown,
    routes.createGameOverScreen,
    (bd) => routes.createGameOverScreen(bd, 'win'),
  );

  const hint = document.createElement('div');
  hint.className = 'abyss-hint';
  const stalItems = (['small', 'medium', 'large'] as const).map((size, i) => `
        <span class="abyss-hint-item abyss-stal" data-size="${size}" hidden>
          <img class="abyss-hint-icon" src="${STALACTITE_SVGS[i]}" alt="${size} stalactites smashed">
          <span class="abyss-hint-count">0</span>
        </span>`).join('');
  hint.innerHTML = `
        <span class="abyss-hint-item">
          <img class="abyss-hint-icon" src="${SPRITES.bomb}" alt="Bombs carried">
          <span class="abyss-hint-count abyss-bombs">0/3</span>
        </span>${stalItems}`;
  (ctx.root.querySelector('.game-stage') as HTMLElement).appendChild(hint);

  game.abyssLoop = attachWorldLoop(game, ABYSS_LOOP, wireMute);
  wireMovement(() => game.player, game.runSignal, () => game.paused);
  wireAction(() => game.action(), game.runSignal, () => game.paused);

  game.paused = true;
  game.coldOpen(() => {
    showInfoModal(ABYSS_MODAL, () => {
      game.paused = false;
      canvas.focus();
      game.startGame();
    });
  });
}
