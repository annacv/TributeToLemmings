// Flow: start → surface → transition → tunnel → transition → abyss
//       → gameOver(death|win) → [win: theEnd] → ranking → start

import { getDebugScreen } from './lib/debugScreen';
import { makeBreakdown } from './lib/score';
import { createAppContext, type ScreenRoutes } from './lib/appContext';
import { createStartScreen } from './screens/startScreen';
import { createGameScreen } from './screens/surfaceScreen';
import { createTransitionScreen } from './screens/transitionScreen';
import { createTunnelScreen } from './screens/tunnelScreen';
import { createAbyssScreen } from './screens/abyssScreen';
import { createGameOverScreen } from './screens/gameOverScreen';
import { createTheEndScreen } from './screens/theEndScreen';
import { createRankingScreen } from './screens/rankingScreen';

function main(): void {
  const root = document.querySelector('#site-main') as HTMLElement;
  const ctx = createAppContext(root);

  const routes: ScreenRoutes = {
    createStartScreen: () => createStartScreen(ctx, routes),
    createGameScreen: () => createGameScreen(ctx, routes),
    createTransitionScreen: (config) => createTransitionScreen(ctx, routes, config),
    createTunnelScreen: (breakdown) => createTunnelScreen(ctx, routes, breakdown),
    createAbyssScreen: (breakdown) => createAbyssScreen(ctx, routes, breakdown),
    createGameOverScreen: (breakdown, variant) => createGameOverScreen(ctx, routes, breakdown, variant),
    createTheEndScreen: (breakdown, submission) => createTheEndScreen(ctx, routes, breakdown, submission),
    createRankingScreen: (currentScore, submission) => createRankingScreen(ctx, routes, currentScore, submission),
  };

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
