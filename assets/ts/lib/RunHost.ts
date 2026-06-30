import { GameLoop } from './GameLoop';

export interface RunHostHooks {
  step: () => boolean;
  render: () => void;
  /** Whether the run has ended; read after each render to gate teardown. */
  isOver: () => boolean;
  /** End-of-run teardown; fired exactly once, the first frame the run is over. */
  onEnd: () => void;
}

/* The run skeleton every simulation-bearing world (Surface, Tunnel, Abyss) shares:
   a fixed-timestep GameLoop plus once-only end-of-run teardown, with a run-scoped
   signal that aborts in lockstep. Composition, not inheritance — each world supplies
   its own step/render/isOver/onEnd and keeps its own HUD, renderer, audio, and
   end-of-run routing.

   One run per host: run-scoped listeners attach with `runSignal`, and `onEnd` fires
   exactly once even though extra frames can render after the halt. */
export class RunHost {
  private readonly hooks: RunHostHooks;
  private readonly loop: GameLoop;
  private readonly controller = new AbortController();
  private ended = false;

  constructor(hooks: RunHostHooks) {
    this.hooks = hooks;
    this.loop = new GameLoop({
      step: hooks.step,
      render: () => this.frame(),
    });
  }

  start(): void {
    this.loop.start();
  }

  /** Aborts when the run ends — attach run-scoped listeners with this signal. */
  get runSignal(): AbortSignal {
    return this.controller.signal;
  }

  /* Runs right after each render. Once the run is over we pull the plug: the runSignal
     aborts and onEnd fires a single time, no matter how many frames sneak in
     afterward. Cleanup and screen swaps belong in onEnd, not mid-render. */
  private frame(): void {
    this.hooks.render();
    if (this.ended || !this.hooks.isOver()) return;
    this.ended = true;
    this.controller.abort();
    this.hooks.onEnd();
  }
}
