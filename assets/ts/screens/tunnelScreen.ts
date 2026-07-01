import { TunnelGame } from '../worlds/tunnel/TunnelGame';
import { buildPlayScreen } from '../lib/playScreen';
import { attachWorldLoop } from '../lib/attachWorldLoop';
import { TUNNEL_MODAL, showInfoModal } from '../lib/infoModal';
import {
  ABYSS_CEILING_HANG_FRAC, TRANSITION_MESSAGE_FROM_START,
} from './transitionScreen';
import {
  ABYSS_CEILING_SVG, CAVE_LOOP, UNDERGROUND_ABYSS_BACKGROUND_SVG,
} from '../assets';
import type { ScoreBreakdown } from '../lib/score';
import type { AppContext, ScreenRoutes } from '../lib/appContext';

export function createTunnelScreen(ctx: AppContext, routes: ScreenRoutes, breakdown: ScoreBreakdown): void {
  const { canvas, wireMovement, wireAction, wireMute } = buildPlayScreen(ctx.root, {
    canvasClass: 'tunnel-game-canvas',
    canvasAriaLabel: 'Tunnel — find the crack and blast your way out',
    secondsStart: 60,
    withAction: true,
  });

  const game = new TunnelGame(
    canvas,
    breakdown,
    routes.createGameOverScreen,
    (bd) => routes.createTransitionScreen({
      breakdown: bd,
      stingerHtml: '&gt; the air grows warm...',
      onArrive: routes.createAbyssScreen,
      backgroundSvg: UNDERGROUND_ABYSS_BACKGROUND_SVG,
      messageScrollT: TRANSITION_MESSAGE_FROM_START,
      ceilingSvg: ABYSS_CEILING_SVG,
      ceilingHangFrac: ABYSS_CEILING_HANG_FRAC,
    }),
  );

  /* Cave loop: respects the mute gate, pauses with the hidden tab, dies with the run */
  game.caveLoop = attachWorldLoop(game, CAVE_LOOP, wireMute);
  /* Gate input while the info modal holds the run paused, so Space activates the
     modal button rather than the (not-yet-started) action verb */
  wireMovement(() => game.player, game.runSignal, () => game.paused);
  wireAction(() => game.action(), game.runSignal, () => game.paused);

  game.paused = true;
  showInfoModal(TUNNEL_MODAL, () => {
    game.paused = false;
    canvas.focus();
    game.startGame();
  });
}
