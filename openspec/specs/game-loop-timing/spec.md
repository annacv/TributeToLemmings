# game-loop-timing

## Purpose

Frame-rate-independent simulation timing: fixed-timestep stepping driven by real elapsed time, real-second score accrual, bounded catch-up after stalls, and step/render decoupling rules for gameplay effects. Implemented by the reusable `GameLoop` (`assets/ts/lib/GameLoop.ts`), the intended driver for all simulation-bearing screens (surface game, tunnel world, abyss).

## Requirements

### Requirement: Simulation advances in fixed timesteps independent of display refresh rate
The game SHALL advance its simulation (player and bomb movement, bomb spawning, collision detection, level progression, ground erosion, and lives accounting) in fixed steps of 1/60 second of simulated time, driven by measured real elapsed time rather than by the number of `requestAnimationFrame` callbacks. The number of simulation steps executed per real second SHALL be 60 regardless of the display's refresh rate.

#### Scenario: 120 Hz display runs at normal speed
- **WHEN** the game runs on a display where `requestAnimationFrame` fires ~120 times per second
- **THEN** the simulation advances ~60 steps per real second, and bombs fall and the player moves at the same real-world speed as on a 60 Hz display

#### Scenario: 30 Hz throttled display runs at normal speed
- **WHEN** `requestAnimationFrame` fires only ~30 times per second
- **THEN** each callback executes the accumulated pending steps (~2), keeping the simulation at the same real-world speed as on a 60 Hz display

#### Scenario: Game start
- **WHEN** `startGame()` is called
- **THEN** the first simulation step executes immediately, without waiting for elapsed time to accumulate

### Requirement: Score measures real survival seconds
The score SHALL increase by exactly 1 for every 60 simulation steps (one real second of survival), on every display refresh rate.

#### Scenario: One second of survival on a 120 Hz display
- **WHEN** the player survives one real second on a 120 Hz display
- **THEN** the score increases by exactly 1

### Requirement: Catch-up after a stall is bounded
The game SHALL clamp the accumulated elapsed time so that a single render callback never executes more than a small fixed number of catch-up steps (at most 5). Time beyond the clamp SHALL be discarded, effectively pausing the simulation during long stalls.

#### Scenario: Returning from a background tab
- **WHEN** the tab is hidden for one minute and then becomes visible again
- **THEN** the next callback executes at most 5 simulation steps, and the game resumes from approximately the state it was in when the tab was hidden

#### Scenario: First callback ignores the page-load time origin
- **WHEN** the first render callback after `startGame()` arrives carrying a large absolute timestamp (milliseconds since page load, e.g. after idling on the splash screen)
- **THEN** zero catch-up steps execute; the callback only initializes the loop's time reference and renders

#### Scenario: Death during catch-up stops stepping
- **WHEN** a catch-up step sets the game over state
- **THEN** no further simulation steps execute in that callback

### Requirement: Rendering occurs once per display frame
The game SHALL render the current simulation state exactly once per `requestAnimationFrame` callback, regardless of how many simulation steps (zero or more) that callback executed.

#### Scenario: High-refresh frame with no pending step
- **WHEN** a callback on a 120 Hz display finds less than one step of accumulated time
- **THEN** the frame is still drawn (unchanged state) and no simulation step runs

### Requirement: Visual effect durations are defined in simulation steps
Frame-counted visual effects tied to gameplay (bomb explosion lifetime, player hit-blink) SHALL be decremented by simulation steps, not by render callbacks, so their real-time duration is identical on every refresh rate. The hit-blink's visibility flicker SHALL alternate per rendered frame (not per step), so a hidden phase never persists longer than one display frame on any refresh rate.

#### Scenario: Hit-blink duration on a 120 Hz display
- **WHEN** the player is hit on a 120 Hz display
- **THEN** the blink effect lasts the same real-world duration as on a 60 Hz display

#### Scenario: First rendered frame after a hit shows the player
- **WHEN** the player loses a life and the next frame is rendered
- **THEN** the player SHALL be drawn (in the blink color), not hidden — the first visible blink frame is the hit feedback

#### Scenario: Blink does not alias away at 30 Hz
- **WHEN** the player is hit on a 30 Hz display (where each callback runs ~2 simulation steps per render)
- **THEN** over the course of the blink, rendered frames SHALL include both visible and hidden phases — the blink never renders as fully invisible or as no blink at all
