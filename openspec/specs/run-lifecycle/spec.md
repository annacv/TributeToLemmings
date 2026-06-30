# run-lifecycle

## Purpose

The shared run-lifecycle contract a simulation-bearing world (surface, tunnel, abyss) obeys: stepping is delegated to the fixed-timestep loop; the run halts when the world's neutral `isOver` flag becomes true; teardown runs exactly once even if extra frames render after the halt; a run-scoped `AbortSignal` aborts at halt so run-scoped listeners die with the run; and teardown routes by outcome to `onComplete` (advance/win) or `onGameOver` (failure). Implemented by the reusable `RunHost` (`assets/ts/lib/RunHost.ts`), composing `GameLoop` and `RunLifecycle`, with each world supplying its own `step`/`render`/`isOver`/`onEnd` hooks and owning its own HUD, renderer, audio, and callbacks.

## Requirements

### Requirement: A world delegates its run to a shared run host
Every simulation-bearing world (surface, tunnel, abyss) SHALL drive its run through a single shared run host rather than each world wiring the fixed-timestep loop and teardown latch itself. The host SHALL be configured with four hooks supplied by the world: a `step` (advance one fixed simulation step, returning whether the run continues), a `render` (draw the current frame), an `isOver` predicate (whether the run has ended), and an `onEnd` callback (the world's teardown). The host SHALL expose `start()` to begin the run.

#### Scenario: World starts its run through the host
- **WHEN** a world calls `start()` on its run host
- **THEN** the host begins driving the world's `step` and `render` hooks via the fixed-timestep loop, exactly as the world running its own loop would

#### Scenario: Host does not own gameplay concerns
- **WHEN** a world is constructed
- **THEN** the world still owns its own HUD, renderer, audio, and its `onComplete` / `onGameOver` callbacks — the run host owns only the loop and the teardown latch

### Requirement: Teardown runs exactly once after the run halts
The run host SHALL invoke the world's `onEnd` teardown exactly once, the first time the run is observed as over, even though additional render frames may still draw after the halting step.

#### Scenario: Extra frames after the halt do not re-tear-down
- **WHEN** the run becomes over and one or more further render frames are drawn before the loop stops
- **THEN** the world's `onEnd` teardown is invoked exactly once, not once per trailing frame

#### Scenario: A run that never ends never tears down
- **WHEN** a run is in progress and `isOver` has never been true
- **THEN** the world's `onEnd` teardown has not been invoked

### Requirement: A run-scoped signal aborts when the run ends
The run host SHALL expose a run-scoped `AbortSignal` that aborts at the moment the run is torn down, so that listeners and audio guards attached with that signal are released with the run and cannot act on behalf of a finished run on a later screen.

#### Scenario: Run-scoped listeners are released at halt
- **WHEN** a world attaches an event listener using the host's run signal, and the run later ends
- **THEN** that listener is removed when the run is torn down and does not fire afterward

#### Scenario: Signal aborts in lockstep with teardown
- **WHEN** the run is torn down
- **THEN** the run signal is aborted as part of that single teardown, not before the run ends and not on a subsequent run

### Requirement: Teardown routes by outcome to completion or game-over
On teardown, a world SHALL route to its `onComplete` callback when the run ended in success/advance, and to its `onGameOver` callback when the run ended in failure. The neutral halt flag (`isOver`) SHALL NOT imply failure — a finished run is most often an advance to the next world. The term "game over" SHALL denote the failing outcome only.

#### Scenario: Failure routes to game over
- **WHEN** a world's run ends because the player failed (e.g. out of lives)
- **THEN** the world invokes `onGameOver` with the run's score breakdown and does not invoke `onComplete`

#### Scenario: Success routes to completion
- **WHEN** a world's run ends because the world was completed (e.g. the surface collapses into the tunnel, or all tunnel cycles are cleared)
- **THEN** the world invokes `onComplete` with the run's score breakdown and does not invoke `onGameOver`

#### Scenario: The halt flag is outcome-neutral
- **WHEN** a world's `isOver` becomes true
- **THEN** the loop halts regardless of outcome, and which callback fires is determined solely by whether the run succeeded or failed — not by the flag itself
