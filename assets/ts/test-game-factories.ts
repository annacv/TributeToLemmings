import { AbyssGame } from './AbyssGame';
import { SurfaceGame } from './SurfaceGame';
import { Bomb } from './Bomb';
import { Player } from './Player';
import { makeBreakdown, type ScoreBreakdown } from './lib/score';

/** Surface → tunnel handoff (3 cleared levels at 5 pts each). */
export const SURFACE_HANDOFF_BREAKDOWN = makeBreakdown({ surfaceTime: 42, levelsBonus: 15 });

/** Tunnel → abyss handoff (surface + tunnel time + 6 cleared levels). */
export const TUNNEL_HANDOFF_BREAKDOWN = makeBreakdown({ surfaceTime: 42, tunnelTime: 30, levelsBonus: 30 });

export function makeAbyssGame(
  canvas: HTMLCanvasElement,
  breakdown: ScoreBreakdown = TUNNEL_HANDOFF_BREAKDOWN,
): AbyssGame {
  const game = new AbyssGame(canvas, breakdown);
  game.startGame();
  return game;
}

export interface SurfaceGameTestOptions {
  player?: boolean;
  muted?: boolean;
  erosion?: boolean;
}

export function makeSurfaceGame(
  canvas: HTMLCanvasElement,
  opts: SurfaceGameTestOptions = { player: true },
): SurfaceGame {
  const game = new SurfaceGame(canvas);
  if (opts.player !== false) game.player = new Player(canvas);
  if (opts.muted) game.gameSong.muted = true;
  if (opts.erosion) game.groundErosionActive = true;
  return game;
}

/** Drops a bomb past the ground line and runs one update (erosion / collapse tests). */
export function dropGroundBomb(game: SurfaceGame, canvas: HTMLCanvasElement, dx = 100): Bomb {
  const bomb = new Bomb(canvas, dx);
  bomb.dy = canvas.height + 1;
  game.bombs.push(bomb);
  game.update();
  return bomb;
}
