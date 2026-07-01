// Flow: start → surface → transition → tunnel → transition → abyss
//       → gameOver(death|win) → [win: theEnd] → ranking → start

import { getDebugScreen } from './lib/debugScreen';
import { makeBreakdown } from './lib/score';
import { createAppContext, type ScreenRoutes } from './lib/appContext';
import { createStartScreen } from './screens/startScreen';
import { createGameScreen } from './screens/surfaceScreen';
import { bindTransitionScreen } from './screens/transitionScreen';
import { createTunnelScreen } from './screens/tunnelScreen';
import { createAbyssScreen } from './screens/abyssScreen';
import { createGameOverScreen } from './screens/gameOverScreen';
import { createTheEndScreen } from './screens/theEndScreen';
import { createRankingScreen } from './screens/rankingScreen';

function main(): void {
  const root = document.querySelector('#site-main') as HTMLElement;
  const ctx = createAppContext(root);

  const routes = {} as ScreenRoutes;
  routes.createStartScreen = () => createStartScreen(ctx, routes);
  routes.createGameScreen = () => createGameScreen(ctx, routes);
  routes.createTransitionScreen = bindTransitionScreen(ctx, routes);
  routes.createTunnelScreen = (breakdown) => createTunnelScreen(ctx, routes, breakdown);
  routes.createAbyssScreen = (breakdown) => createAbyssScreen(ctx, routes, breakdown);
  routes.createGameOverScreen = (breakdown, variant) => createGameOverScreen(ctx, routes, breakdown, variant);
  routes.createTheEndScreen = (breakdown, submission) => createTheEndScreen(ctx, routes, breakdown, submission);
  routes.createRankingScreen = (currentScore, submission) => createRankingScreen(ctx, routes, currentScore, submission);

  const debugScreen = getDebugScreen();
  if (debugScreen === 'transition') routes.createTransitionScreen({ breakdown: makeBreakdown({ surfaceTime: 42 }) });
  else if (debugScreen === 'tunnel') routes.createTunnelScreen(makeBreakdown({ surfaceTime: 42, levelsBonus: 15 }));
  else if (debugScreen === 'abyss') routes.createAbyssScreen(makeBreakdown({ surfaceTime: 42, tunnelTime: 30, levelsBonus: 30 }));
  else if (debugScreen === 'theend') {
    routes.createTheEndScreen(
      makeBreakdown({ surfaceTime: 42, tunnelTime: 30, abyssTime: 24, levelsBonus: 45 }),
      Promise.resolve({ error: false, docId: null, bestScore: null }),
    );
  }
  else routes.createStartScreen();
}

window.addEventListener('load', main);
