import { RANKING_MUSIC } from '../assets';
import { isMuted, safePlay } from './audio';
import type { ScoreBreakdown } from '../lib/score';
import type { TransitionConfig } from '../screens/transitionScreen';

export type SubmissionResult = { error: boolean; docId: string | null; bestScore: number | null };

export type ScreenRoutes = {
  createStartScreen: () => void;
  createGameScreen: () => void;
  createTransitionScreen: (config: TransitionConfig) => void;
  createTunnelScreen: (breakdown: ScoreBreakdown) => void;
  createAbyssScreen: (breakdown: ScoreBreakdown) => void;
  createGameOverScreen: (breakdown: ScoreBreakdown, variant?: 'death' | 'win') => void;
  createTheEndScreen: (breakdown: ScoreBreakdown, submission: Promise<SubmissionResult>) => void;
  createRankingScreen: (currentScore: number, submission: Promise<SubmissionResult>) => void;
};

class RankingMusicController {
  private music: HTMLAudioElement | null = null;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (!this.music) return;
      if (document.hidden) this.music.pause();
      else safePlay(this.music);
    });
  }

  stop(): void {
    if (this.music) {
      this.music.pause();
      this.music = null;
    }
  }

  private ensureMusic(): void {
    if (this.music) return;
    this.music = new Audio(RANKING_MUSIC);
    this.music.loop = true;
    this.music.muted = isMuted();
    if (!document.hidden) safePlay(this.music);
  }

  startOnGameOver(root: HTMLElement): void {
    if (!root.querySelector('.game-over-screen, .ranking-screen')) return;
    this.ensureMusic();
  }

  ensureOnRankingMount(): void {
    this.ensureMusic();
  }

  setMuted(muted: boolean): void {
    if (this.music) this.music.muted = muted;
  }

  disposeForPlayAgain(): void {
    if (this.music) {
      this.music.pause();
      this.music.src = '';
      this.music = null;
    }
  }
}

export type AppContext = {
  root: HTMLElement;
  buildDom: (html: string) => HTMLElement;
  getPlayerName: () => string;
  setPlayerName: (name: string) => void;
  rankingMusic: RankingMusicController;
};

export function createAppContext(root: HTMLElement): AppContext {
  let playerName = '';

  return {
    root,
    buildDom(html: string): HTMLElement {
      root.innerHTML = html;
      return root;
    },
    getPlayerName: () => playerName,
    setPlayerName: (name: string) => { playerName = name; },
    rankingMusic: new RankingMusicController(),
  };
}
