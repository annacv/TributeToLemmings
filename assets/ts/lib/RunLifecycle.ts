/* One run per instance: run-scoped listeners attach with `signal`, and the
   end-of-run teardown fires exactly once even though extra frames can render
   after the halt. World classes (surface game, tunnel, abyss) share this shape
   while keeping their own end-of-run policy in the callback. */
export class RunLifecycle {
  private controller = new AbortController();
  private ended = false;

  /** Aborts when the run ends — attach run-scoped listeners with this signal. */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /** Call from the post-render latch: when `over` is true, aborts the signal and
      runs `onEnd` exactly once; later calls are no-ops. Screen swaps and other
      side effects belong in `onEnd`, never in the final render itself. */
  settle(over: boolean, onEnd: () => void): void {
    if (!over || this.ended) return;
    this.ended = true;
    this.controller.abort();
    onEnd();
  }
}
