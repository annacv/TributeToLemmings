# tunnel-transition

## Purpose

The handoff from the surface game to the tunnel world: the `tunnelWorldCallback` interface, the "TO BE CONTINUED" interstitial, and score continuity across screens.

## Requirements

### Requirement: triggerTunnelWorld callback interface
`Game` SHALL expose a `tunnelWorldCallback(fn: (breakdown: ScoreBreakdown) => void)`
method that registers a handler called when ground erosion is complete. This mirrors the
existing `gameOverCallback` pattern. The callback SHALL receive the score breakdown
object (per `run-scoring`) reflecting the run state at the moment of transition,
including the surface seconds and the 5 × surface-levels-completed contribution.

#### Scenario: Registered callback is invoked on full erosion
- **WHEN** `erosionCounter >= EROSION_CAPACITY` and a tunnel world callback has been
  registered
- **THEN** `onTunnelWorld(breakdown)` SHALL be called with the surface component and
  the surface levels bonus populated, and the game loop SHALL not continue

#### Scenario: No double-fire with onGameOver
- **WHEN** the tunnel world transition fires
- **THEN** `onGameOver` SHALL NOT be called; only `onTunnelWorld` fires

### Requirement: "TO BE CONTINUED" stub when no tunnel world callback is registered
If no `onTunnelWorld` handler has been set when ground erosion completes, `main.ts` SHALL
display a "TO BE CONTINUED" interstitial screen before routing to the Game Over screen.
This stub path is retained as a fallback; with Iteration V wired, the registered-handler
path (see ADDED requirement below) is the production route.

#### Scenario: Stub screen shown when no handler is wired
- **WHEN** ground erosion completes and `onTunnelWorld` is null
- **THEN** a full-screen interstitial SHALL render in the retro pixel style with the text
  "TO BE CONTINUED" before transitioning to the Game Over screen

#### Scenario: Interstitial composition
- **WHEN** the "TO BE CONTINUED" canvas renders
- **THEN** it SHALL show the bottom portion of `background-game.svg` cropped so only the base of the tree (~8% of its height) remains visible above the grass line near the top of the frame (keeping the fall from reading treetop-high), with the single `background-underground.svg` strip (800×2800, drawn once) carrying everything below the sky: the continuous collapse shaft baked in via svg defs/use (overlapping, x-jittered, depth-fading rows from the grass line — `ground-erosion.svg` artwork strictly alternating with `ground-hole` variants — never two erosion frames in consecutive rows; holes on rows 1/3/5/7 (hole-4, hole-1, hole-3, hole-4) at the same slot size, one asset per row, drawn after the erosion column so they stay visible), the dirt, the navy veils easing into the tunnel-world reveal at the foot of the shaft (cave walls closing in + the speckled dirt floor shelf with moss at y≈2688, mirroring background-tunnel.svg) — and the lemming SHALL fall from above the top edge into the topmost hole and remain inside eroded ground all the way down

#### Scenario: Ground scrolls away to extend the fall
- **WHEN** the lemming reaches the collapse hole
- **THEN** the camera SHALL follow the lemming downward — the ground frame and backdrop scrolling up and out of view with ease-in-out motion (accelerating into the dark, braking into arrival), passing underground dirt and stepped navy veils that ease into the tunnel-world reveal at the foot of the shaft — and SHALL come to rest on the cave chamber the lemming drops into: earth walls closing in and the speckled dirt floor shelf with moss (mirroring background-tunnel.svg) so the landing reads continuous with the tunnel screen; the rest beat (≈500 ms veil lift after the camera settles) fades the chamber in, with the stinger over it

#### Scenario: Stub screen routes to Game Over after a fixed delay
- **WHEN** the "TO BE CONTINUED" screen is displayed with no tunnel handler wired
- **THEN** after a short fixed delay (≈3 s, covering the fall and scroll phases) it SHALL
  automatically route to the Game Over screen

#### Scenario: Score is preserved through the stub transition
- **WHEN** the stub routes to Game Over
- **THEN** the breakdown passed onward SHALL be the same breakdown received by the stub

### Requirement: Score is cumulative; level resets per screen
The run score SHALL accumulate across all screens in a single run as a breakdown object
(per `run-scoring`): surface seconds, levels completed (surface + tunnel), and underground
banked values. Each new screen SHALL start at its own difficulty/cycle origin (level 1 /
depth 1 in HUD terms) regardless of progress on the previous screen.

#### Scenario: Score from the surface game carries into the next screen
- **WHEN** either `onGameOver` or `onTunnelWorld` fires
- **THEN** the breakdown SHALL reflect everything earned since the last "Play again"
  action

#### Scenario: Level index resets when a new screen starts
- **WHEN** the game transitions to the tunnel world (or any subsequent screen)
- **THEN** that screen's difficulty/cycle SHALL begin at its own origin, independent of
  the surface game's final level

### Requirement: Interstitial routes into the tunnel when a handler is registered
The fall interstitial SHALL route into the tunnel screen instead of Game Over when an
`onTunnelWorld` handler is registered (Iteration V wired). The fall (≈0.5 s) and camera
dive (≈1.7 s) beats are unchanged; the mid-scroll "TO BE CONTINUED" text SHALL NOT
render. The veil SHALL lift onto the tunnel floor, a `> somewhere underground...` stinger
(`.tbc-line` style) SHALL fade in, and after a ≈600 ms breath the tunnel controls modal
SHALL appear (first visit only).

#### Scenario: Arrival replaces the cliffhanger
- **WHEN** the camera comes to rest with a tunnel handler registered
- **THEN** no "TO BE CONTINUED" text SHALL appear; the resting frame SHALL be the tunnel
  floor with the location stinger, followed by the controls modal after the breath beat

#### Scenario: Breakdown carries into the tunnel
- **WHEN** the interstitial hands off to the tunnel screen
- **THEN** the tunnel SHALL receive the breakdown unchanged (surface seconds + surface
  levels bonus already applied)

### Requirement: Interstitial honors reduced motion and focuses visible content
The JS-driven camera scroll SHALL check `prefers-reduced-motion` and, when set, jump to
the resting frame without animated scrolling. During the interstitial, keyboard focus
SHALL be placed on visible content (e.g. the overlay text), never on an `aria-hidden`
element.

#### Scenario: Reduced motion skips the dive
- **WHEN** the interstitial plays for a user with `prefers-reduced-motion: reduce`
- **THEN** the camera SHALL present the resting frame directly (no animated fall/scroll)
  and the audio/timing of the subsequent beats SHALL still resolve

#### Scenario: Focus lands on visible content
- **WHEN** the interstitial mounts
- **THEN** `document.activeElement` SHALL be a visible, non-`aria-hidden` element
