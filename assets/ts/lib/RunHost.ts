import { GameLoop } from './GameLoop';
import { RunLifecycle } from './RunLifecycle';

export interface RunHostHooks {
  step: () => boolean;
  render: () => void;
  /** Whether the run has ended; read after each render to gate teardown. */
  isOver: () => boolean;
  /** End-of-run teardown; fired exactly once, the first frame the run is over. */
  onEnd: () => void;
}

/* The run skeleton every simulation-bearing world (Surface, Tunnel, Abyss) shares:
   a fixed-timestep GameLoop wired to a RunLifecycle so teardown fires exactly once
   after the halt, with a run-scoped signal that aborts in lockstep. Composition,
   not inheritance — each world supplies its own step/render/isOver/onEnd and keeps
   its own HUD, renderer, audio, and end-of-run routing. */
export class RunHost {
  private readonly hooks: RunHostHooks;
  private readonly loop: GameLoop;
  private readonly run = new RunLifecycle();

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

  get signal(): AbortSignal {
    return this.run.signal;
  }

  private frame(): void {
    this.hooks.render();
    this.run.settle(this.hooks.isOver(), this.hooks.onEnd);
  }
}
