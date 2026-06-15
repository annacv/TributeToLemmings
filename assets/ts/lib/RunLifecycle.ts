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

  /** Runs this right after each render. Once the run is `over`, we pull the plug:
      the signal aborts and `onEnd` fires a single time, no matter how many frames
      sneak in afterward. Cleansup and screen swaps in `onEnd`, not at mid-render. */
  settle(over: boolean, onEnd: () => void): void {
    if (!over || this.ended) return;
    this.ended = true;
    this.controller.abort();
    onEnd();
  }
}
