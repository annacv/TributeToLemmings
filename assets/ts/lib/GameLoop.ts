export const STEPS_PER_SECOND = 60;

export const STEP_MS = 1000 / STEPS_PER_SECOND;
export const MAX_CATCHUP_STEPS = 5;
/* Frame deltas that are exactly one step long can land a few ulps below STEP_MS
   (float subtraction of near-equal timestamps); without a tolerance the loop
   silently drops steps that are mathematically due */
const STEP_EPSILON_MS = 1e-6;

export interface GameLoopHooks {
  /** Advance the simulation by one fixed 1/60 s step; return false to halt the loop. */
  step: () => boolean;
  /** Draw the current state; called exactly once per display frame. */
  render: () => void;
}

/* Fixed-timestep driver: the simulation advances in 1/60 s steps measured from
   rAF timestamps, so game speed and score are identical on every display
   refresh rate. Timing shell only — game state and render policy stay in the
   consumer. Not for cinematics: elapsed-time tweens are already rate-correct
   on plain rAF timestamps. */
export class GameLoop {
  private readonly hooks: GameLoopHooks;
  private rafId: number | null = null;
  private stopped = false;
  private lastFrameTime: number | null = null;
  private accumulatedMs = 0;

  constructor(hooks: GameLoopHooks) {
    this.hooks = hooks;
  }

  start(): void {
    if (this.rafId !== null) return;
    this.stopped = false;
    this.lastFrameTime = null;
    this.accumulatedMs = 0;
    /* Synchronous first step + render so the game starts without a blank frame */
    const alive = this.hooks.step();
    this.hooks.render();
    if (alive) this.rafId = requestAnimationFrame((ts) => this.onFrame(ts));
  }

  stop(): void {
    /* The flag also covers stop() from inside a step/render callback, where the
       stored rafId is already stale and onFrame must not reschedule */
    this.stopped = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private onFrame(timestamp: number): void {
    this.rafId = null;
    /* rAF timestamps are ms since page load; the first callback only anchors the
       clock, so time spent on earlier screens never counts as elapsed play time */
    if (this.lastFrameTime !== null) {
      this.accumulatedMs = Math.min(
        this.accumulatedMs + (timestamp - this.lastFrameTime),
        MAX_CATCHUP_STEPS * STEP_MS,
      );
    }
    this.lastFrameTime = timestamp;

    let halted = false;
    while (!halted && this.accumulatedMs >= STEP_MS - STEP_EPSILON_MS) {
      this.accumulatedMs -= STEP_MS;
      halted = !this.hooks.step();
    }
    this.hooks.render();

    if (!halted && !this.stopped) {
      this.rafId = requestAnimationFrame((ts) => this.onFrame(ts));
    }
  }
}
