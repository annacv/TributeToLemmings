# tunnel-escape

## Purpose

The underground tunnel screen: a `TunnelGame` sibling on `GameLoop` where the lemming
escapes three escalating cycles by picking up, placing, and lighting bombs at a randomized
floor crack while a lowering ceiling threatens to crush it. Covers the environment,
per-cycle escalation, crush death/respawn, the bomb verb, touch/controls/HUD/audio, the
tiered downward-drop falls, and the Abyss tease that ends the run.

## Requirements

### Requirement: Tunnel screen runs on GameLoop via a sibling TunnelGame class
The tunnel screen SHALL be driven by a `TunnelGame` class that consumes `GameLoop`
unmodified and is composed from the shared run-infrastructure modules (run lifecycle,
HUD, audio channels, fx helpers). `TunnelGame` SHALL NOT inherit from `Game`.

#### Scenario: Tunnel simulation is frame-rate independent
- **WHEN** the tunnel screen runs on displays of different refresh rates
- **THEN** cycle timing, countdown, and movement SHALL derive from fixed simulation steps
  (60/s), producing identical outcomes for identical inputs

#### Scenario: End-of-run callbacks fire only from the once-latch
- **WHEN** a cycle completes or the run ends mid-step
- **THEN** the final render SHALL be side-effect-free and any screen swap SHALL execute
  only from the run lifecycle's ended-once latch

### Requirement: Confined underground environment with lowering ceiling
The tunnel screen SHALL render a confined underground environment following the
tunnel-world palette (rust as the only warm accent; full-opacity rust reserved for
interactive objects; brand blue UI-only). Across the three escape cycles the ceiling
SHALL lower so that compression is readable at the lemming's scale, and within each
cycle the ceiling SHALL continue drifting downward at that cycle's velocity, derived
from fixed simulation steps. Drift SHALL be suspended during the staged lowering event,
explosion resolution, and pause. Ceiling collision SHALL be a single flat line at the
deepest tooth of the ceiling asset (never per-tooth), and all ceiling heights SHALL be
stored as canvas-height fractions.

#### Scenario: Ceiling lowers between cycles as a staged event
- **WHEN** an escape cycle completes
- **THEN** a short ground-shake + grinding-rumble SFX SHALL fire FIRST as a telegraph
  (~300 ms, before the ceiling moves), and only then SHALL the ceiling lower by ~12–15% of
  canvas height over an ~800 ms step-counted drop; the new level's crack and bombs SHALL
  already be laid out as the chamber arrives (not added after); continuous drift stays
  suspended for the whole event

#### Scenario: Ceiling drifts down during a cycle
- **WHEN** a cycle is active and not paused, mid-staged-event, or resolving an explosion
- **THEN** the ceiling SHALL advance downward per fixed simulation step at the cycle's
  configured velocity, producing identical positions for identical step counts

#### Scenario: Near-crush telegraph
- **WHEN** the headroom above the lemming enters the danger band above the kill line
- **THEN** the lemming SHALL show the crouch/look-up frame and the grinding rumble SHALL
  play, before any crush can occur

#### Scenario: Reduced motion does not stop the ceiling
- **WHEN** the user prefers reduced motion
- **THEN** screen shake SHALL be suppressed but the ceiling SHALL keep lowering at full
  gameplay velocity (the ceiling is gameplay, not decoration)

#### Scenario: Final cycle reads as cramped
- **WHEN** the third cycle is active
- **THEN** the headroom above the lemming SHALL be at most ~2 lemming-heights

### Requirement: Per-cycle escalation of ceiling pressure
Each cycle SHALL define its ceiling starting height and drift velocity in a per-level
tunables table. Cycle 2 SHALL start with a lower ceiling than cycle 1; cycle 3 SHALL
start lower still AND drift faster (velocity escalation is introduced only at cycle 3).
A solvability invariant SHALL be enforced by an automated test over the tunables: the
time-to-crush from the starting height SHALL exceed the countdown budget on cycles 1–2,
and only cycle 3 MAY crush within the budget (no sooner than ~40 s).

#### Scenario: Cycle differences follow the ratified curve
- **WHEN** cycles 1, 2, and 3 begin
- **THEN** cycle 2 SHALL differ from cycle 1 by crack-mark appearance/placement and a
  lower ceiling start, and cycle 3 SHALL differ from cycle 2 by crack-mark
  appearance/placement, a lower ceiling start, and a faster drift velocity

#### Scenario: Tuning cannot make a cycle unwinnable
- **WHEN** the per-level tunables are changed
- **THEN** the solvability invariant tests SHALL fail at `npm test` if time-to-crush no
  longer exceeds the budget on cycles 1–2 or falls below ~40 s on cycle 3

### Requirement: Ceiling crush is the only death source, with cycle-start respawn
The ceiling SHALL be the tunnel's only way to lose a life (the countdown never kills).
The lemming SHALL be crushed when headroom reaches the kill line
(`CRUSH_HEADROOM_FRAC`, lemming height minus a margin so the crouch telegraph precedes
the kill). On crush with lives remaining, the same cycle SHALL restart with: the
remaining countdown time at the moment of death, the remaining lives, the same
crack-mark appearance, a re-randomized crack position (placed no closer than a shared
minimum distance from the respawn point), and the ceiling reset to that cycle's starting
height. Drift SHALL resume immediately at the cycle's velocity and the near-crush
telegraph SHALL re-arm.

#### Scenario: Crush consumes a life and restarts the cycle from its start height
- **WHEN** the ceiling reaches the kill line and lives remain after the loss (e.g. a
  crush on cycle 2 leaves 2 lives and 40 seconds on the countdown)
- **THEN** the cycle SHALL restart with the ceiling at that cycle's starting height, the
  remaining countdown time (40 s), the remaining lives (2), the same crack appearance,
  and a new random crack position

#### Scenario: Crush during the lit fuse cancels cleanly
- **WHEN** the ceiling crushes the lemming while a fuse is lit or a bomb is carried or
  placed
- **THEN** the armed state SHALL be cancelled, the fuse tick loop SHALL stop in the same
  moment, a carried bomb SHALL return to its pickup spawn, a placed bomb SHALL be removed
  with the old crack, and exactly one of {cycle banked, death} SHALL resolve through the
  run lifecycle's once-latch

#### Scenario: Crush during the staged lowering event
- **WHEN** death occurs while the ~800 ms staged lowering event is in flight
- **THEN** the event SHALL be cancelled and the ceiling SHALL reset to the cycle's
  starting height with the respawn (no replay of the event's rumble/shake)

#### Scenario: Crush feedback works without sound or motion
- **WHEN** a crush occurs with audio muted and/or reduced motion preferred
- **THEN** the crush SHALL still read visually via the crouch frame plus a brief
  (~250 ms) hit-stop or single flash (no shake)

### Requirement: Three escape cycles with randomized floor-crack placement
Each tunnel screen SHALL consist of exactly three escape cycles. In each cycle a single
crack SHALL be placed on the **floor** (along the walkable line) at a random x position,
re-randomized every cycle so positions cannot be memorized, and kept clear of the player
spawn point and of the cycle's bombs. There SHALL be no left/right exit direction and no
special-cased final cycle: every cycle exits **downward**.

#### Scenario: Crack position changes between cycles
- **WHEN** a new cycle starts
- **THEN** the crack's floor x SHALL be randomly chosen independently of previous cycles,
  within the walkable band and not overlapping the spawn point or a bomb

#### Scenario: Crack position re-randomizes on crush respawn
- **WHEN** the cycle restarts after a ceiling crush
- **THEN** the crack SHALL be re-placed by the same random placement path (appearance
  unchanged, x independent of the pre-death x, respecting the minimum distance from the
  respawn point)

#### Scenario: Every cycle exits downward
- **WHEN** any cycle's bombs explode and breach the floor
- **THEN** the exit SHALL be a downward drop (no cycle, including the third, exits to the
  side)

#### Scenario: Completing the third cycle ends the screen
- **WHEN** the third explosion breaches the floor
- **THEN** the screen SHALL play the Abyss tease and route onward; no fourth cycle starts

### Requirement: Each level uses its own single crack mark
The floor crack SHALL be rendered as a single per-level crack-mark asset, drawn in one
`drawImage` (the way the surface game draws a sprite) at a fixed height shared by all
levels, keeping the asset's native aspect ratio. The mapping is fixed: level 1 uses
`crack-mark-3.svg`, level 2 uses `crack-mark-1.svg`, level 3 uses `crack-mark-2.svg`.
Neither the mark nor its position SHALL be inherited between levels — each level's mark is
its own and its x is re-randomized when the level begins.

#### Scenario: Per-level crack mark mapping
- **WHEN** a cycle begins
- **THEN** the floor crack SHALL render that level's single mark (L1 → `crack-mark-3.svg`,
  L2 → `crack-mark-1.svg`, L3 → `crack-mark-2.svg`) at the shared height, and the previous
  level's mark/position SHALL NOT appear on the new chamber

### Requirement: Bomb pick, place, and light mechanic on a single action verb
The player SHALL escape each cycle by picking up an unexploded bomb, placing it at the
floor crack, and lighting it with three action presses. The action verb (Space on keyboard,
the touch action button on touch devices) SHALL map to exactly one meaning determined
by the mechanic state: `explore/near bomb` → pick up; `carrying/at crack` → place;
`placed` → light (three presses arm the fuse). "At the crack" SHALL be a horizontal
proximity to the crack's floor x. Lighting SHALL require the lemming to be at the crack
(he cannot detonate from across the room), and once the fuse is lit the lemming SHALL be
locked in place through the fuse so he drops through the pit he lit — never repositioned
or teleported onto it on breach.

#### Scenario: One press picks up one bomb
- **WHEN** the player presses the action verb while adjacent to an unexploded bomb and
  carrying nothing
- **THEN** exactly one bomb SHALL be picked up, with a pickup SFX one-shot

#### Scenario: Placing at the crack
- **WHEN** the player presses the action verb while standing within horizontal range of the
  floor crack's x and carrying a bomb
- **THEN** the bomb SHALL be placed at the crack

#### Scenario: Three presses light the fuse
- **WHEN** all bombs are placed and the player presses the action verb three times while
  standing at the crack
- **THEN** the fuse SHALL ignite with a fuse animation and visible countdown, the fuse
  tick loop SHALL play, and on explosion the tick SHALL stop, the explosion SFX SHALL
  fire, and the floor SHALL breach open triggering the downward drop into the next cycle

#### Scenario: Lighting requires standing on the charge
- **WHEN** all bombs are placed but the lemming is not at the crack
- **THEN** the light verb SHALL NOT be offered and pressing the action verb SHALL do
  nothing (he cannot detonate from afar)

#### Scenario: The lemming is committed through the lit fuse
- **WHEN** the fuse is lit
- **THEN** the lemming SHALL be locked in place for the duration of the fuse (movement
  input ignored) and SHALL drop through the pit from where he lit it, with no teleport
  on breach

#### Scenario: Key auto-repeat is ignored
- **WHEN** a keydown event arrives with `event.repeat === true`
- **THEN** no game action SHALL fire

#### Scenario: Space never activates a focused UI control during play
- **WHEN** Space is pressed while a UI control (e.g. the mute button) has focus during an
  active tunnel run
- **THEN** the game action SHALL fire and the focused control SHALL NOT be activated

### Requirement: Touch action button
On touch devices the tunnel screen SHALL show a single action button (styled like the
existing touch controls) whose press is equivalent to Space in the same mechanic state. No
additional touch gestures or virtual d-pad SHALL be introduced. *(Ratified 2026-06-16: the
per-verb contextual label was dropped — `currentVerb()` was removed as unused and the button
keeps a static "SPACE" label; the action it fires is still the state's current verb.)*

#### Scenario: Button press equals key press
- **WHEN** the touch button is pressed
- **THEN** the outcome SHALL be identical to pressing Space in the same state

### Requirement: Tunnel controls modal
Before the first tunnel run begins, a retro-styled controls modal SHALL explain the new
controls using the parameterized info-modal pattern with its own dismissal storage key.
While the modal is open the simulation SHALL be paused via a consumer-side flag (no
GameLoop API change) and the run input handler SHALL be inert.

#### Scenario: Returning player still sees tunnel controls once
- **WHEN** a player who previously dismissed the surface info modal reaches the tunnel
  for the first time
- **THEN** the tunnel controls modal SHALL be shown (separate storage key)

#### Scenario: Modal content teaches all three meanings and touch
- **WHEN** the tunnel controls modal renders
- **THEN** it SHALL present three left-aligned rows mapping the action verb to pick
  up / place / light, include the footer line "> escape fast. bonus per breakout.", and
  on touch devices reference the touch action button

#### Scenario: Simulation frozen under the modal
- **WHEN** the modal is open
- **THEN** simulation steps SHALL early-return (render may continue) and no game action
  SHALL be triggerable

### Requirement: Tunnel HUD shows countdown and depth
The tunnel HUD SHALL reuse the existing HUD slots: the score slot displays the countdown
(label swapped with a blink on entry) and the level slot displays the cycle as
`depth N/3`. At ≤10 seconds remaining the countdown digits SHALL enter a warning state
(warning color with a gentle 1 Hz pulse; color-only under `prefers-reduced-motion`).

#### Scenario: Entry signals the rule change
- **WHEN** the tunnel screen starts
- **THEN** the score slot label SHALL swap (sec → time) with `blinkHudItem` feedback and
  the countdown SHALL start from the configured budget

#### Scenario: Low-time warning respects reduced motion
- **WHEN** the countdown reaches 10 seconds and the user prefers reduced motion
- **THEN** the digits SHALL change color with no pulse animation

### Requirement: Tunnel audio
On tunnel screen entry a new looping underground/cave background track SHALL start,
distinct from the surface track. The SFX set (bomb pickup one-shot, `SCRAPE.WAV`
match-strike on each light press, fuse tick loop that stops on explosion or death,
breach explosion = `BANG.WAV`, ceiling crush = `TENTON.WAV`, ceiling-lower grinding
rumble) SHALL play through the shared audio channel helper. All tunnel audio SHALL respect the existing mute gate and pause when the tab is
hidden. Sound vocabulary invariants: `BANG.WAV` means a bomb breaks earth (surface
ground-crack and tunnel breach), `TENTON.WAV` means earth comes down on you (surface
collapse sting and tunnel crush), and `DIE.WAV` SHALL play only on *death* Game Over
arrival — never per life lost and never on the win path, in either world.

#### Scenario: Mute gate covers every new cue
- **WHEN** audio is muted via the existing mute control
- **THEN** no tunnel music or SFX SHALL be audible, including the fuse tick loop and the
  crush SFX

#### Scenario: Fuse tick stops on explosion or death
- **WHEN** the fuse countdown completes and the explosion fires, or the lemming is
  crushed while the fuse is lit
- **THEN** the fuse tick loop SHALL stop in the same moment

#### Scenario: Crush plays the squash, not the death knell
- **WHEN** the ceiling crushes the lemming (any life, including the last)
- **THEN** `TENTON.WAV` SHALL play at the crush moment and `DIE.WAV` SHALL NOT play
  there; on the last life `DIE.WAV` plays only when the Game Over screen is reached,
  exactly once

### Requirement: Abyss tease on screen completion
The final cycle SHALL breach like the others — the floor pit opens (booom + `ground-hole`)
and the lemming drops through in the tunnel canvas — and then end the run, handing off to a
dedicated **Tunnel→Abyss transition screen** built the same way as the surface→tunnel
handoff (a collapse-shaft fall, here descending through `background-underground-abyss.svg`).
That transition SHALL carry a `> the air grows warm...` stinger (in the `.tbc-line` style)
that fades in **from the very start of the fall**, long before the scroll reveals the Abyss
at the foot of the shaft — unlike the surface→tunnel handoff, which holds its line until the
camera comes to rest. The stinger SHALL flash rather than persist: it fades back out once it
has been on screen for ~1 s. On arrival the transition SHALL route to the end screen's win
variant. The door and the balloon SHALL NOT appear,
and no recognizable Iteration VI structure SHALL be shown. Ceiling drift SHALL remain
suspended from the final breach onward, and no crush SHALL resolve after the cycle's bank
has latched. The transition SHALL honor `prefers-reduced-motion` exactly as the
surface→tunnel handoff does (jump to the resting frame).

#### Scenario: Final breach opens the hole, then falls to the Abyss
- **WHEN** the third cycle's bombs explode
- **THEN** the floor pit SHALL blast open (the boom beat) and the run SHALL end right there
  — with no in-tunnel camera pan into a next-deeper chamber (unlike cycles 1–2, which drop
  through into the next chamber) — and the Tunnel→Abyss collapse-shaft transition SHALL
  play the fall down `background-underground-abyss.svg` before the win screen

#### Scenario: Victory cannot be interrupted by the ceiling
- **WHEN** the final breach resolves and the run ends
- **THEN** the ceiling SHALL NOT advance or crush, and the end-of-run SHALL fire exactly
  once through the once-latch with the cycle-3 bank intact

#### Scenario: Abyss stinger reads from the start of the fall
- **WHEN** the Tunnel→Abyss transition begins (the fall)
- **THEN** the `> the air grows warm...` stinger SHALL fade in from the very start of the
  fall, long before the scroll reveals the Abyss at the foot of the shaft — unlike the
  surface→tunnel handoff, which holds its line until the camera comes to rest — and SHALL
  fade back out after ~1.5 s on screen

#### Scenario: Completion routes onward with the breakdown
- **WHEN** the Abyss transition completes (Iteration VI not yet wired)
- **THEN** the screen SHALL route to the end screen's win variant carrying the full
  score breakdown (headline `> You made it! For now...`, spec'd in `run-scoring`)

### Requirement: Player death in the tunnel ends the run with banked score
The tunnel player SHALL start each screen with 3 lives, lost only to the ceiling crush.
Losing all lives SHALL end the run and route to the Game Over flow with the breakdown
containing all banked values; the unbanked remainder of the current cycle is lost.

#### Scenario: Death keeps banked cycles
- **WHEN** the player dies during cycle 3 having banked cycles 1 and 2
- **THEN** the submitted breakdown SHALL include the banked values from cycles 1 and 2
  and nothing from cycle 3

### Requirement: Inter-cycle exit is a downward drop
On each breach the exit SHALL be a vertical descent into the next-deeper chamber. The
explosion SHALL blast a floor pit (rendered with the `ground-hole-*.svg` frames opening
0→3 downward into the floor), the camera SHALL drop vertically into an identical
next-deeper chamber, the lemming SHALL fall with the dropping floor (no walk cycle during
the fall), and on arrival the pit SHALL seal above the lemming's head (frames 3→0 at the
new chamber's ceiling line) before the level-announce and ceiling-drop event run. The drop
SHALL be derived from fixed simulation steps (frame-rate independent). Under
`prefers-reduced-motion` the drop SHALL jump-cut to the resting frame with the lemming
landed and the pit sealed overhead. The third cycle's drop SHALL NOT seal (it flows into
the Abyss tease).

#### Scenario: Breach drops the lemming into the next chamber
- **WHEN** a cycle's fuse expires and the floor breaches
- **THEN** the camera SHALL drop vertically, the lemming SHALL fall without a walk cycle,
  and the next cycle SHALL begin in the deeper chamber after the pit seals overhead

#### Scenario: Drop is frame-rate independent
- **WHEN** the breach drop runs on displays of different refresh rates
- **THEN** the drop timing and arrival SHALL be identical for identical inputs (fixed
  simulation steps)

#### Scenario: Reduced motion drop
- **WHEN** `prefers-reduced-motion` is set and a breach occurs
- **THEN** the drop tween SHALL be skipped and the next chamber SHALL render directly with
  the lemming landed and (cycles 1–2) the pit sealed overhead

### Requirement: Falls are tiered into world-boundary and inner-cycle drops
The three "falling" moments in a run SHALL be differentiated so the player reads room
changes apart from world changes:
(A) the Foreground→Tunnel entry fall (the long collapse-shaft descent, per
`tunnel-transition`), (B) the inner-cycle breach drops (cycle 1→2 and 2→3), and (C) the
cycle-3 drop into the Abyss. Inner drops (B) SHALL be visibly shorter than the
world-boundary falls and SHALL keep both the old ceiling-pit and the new floor partly in
frame (never cutting to pure black), braking into arrival. The world-boundary falls (A and
C) SHALL share a duration/easing envelope (A brakes into a rest; C never brakes and never
seals). The original `FALLING_SFX` (`intro-falling-sound-effect.mp3`) SHALL be reserved for
the world-boundary falls (A and C); inner drops (B) SHALL use a distinct, shorter cue built
from the existing tunnel SFX palette (the breach `BANG` over the pit, a `CHAIN`-style
descent under the drop), never the crush `TENTON`. A bespoke inner-fall cue MAY later
replace the placeholder (an Anna-supplied asset; the spec governs behavior, not the file).
Rust and speed-lines SHALL NOT appear on inner drops (both are reserved for the
world-boundary falls / Abyss direction-cue).

#### Scenario: Inner drop reads as a short room change
- **WHEN** a cycle 1→2 or 2→3 breach drop plays
- **THEN** it SHALL be shorter than the entry fall, keep both chambers partly in frame, and
  play the inner-drop cue (not `FALLING_SFX`, not `TENTON`)

#### Scenario: World-boundary falls share an identity
- **WHEN** the Foreground→Tunnel entry fall (A) or the cycle-3 Abyss drop (C) plays
- **THEN** both SHALL use the reserved `FALLING_SFX` and a matching duration/easing
  envelope, with A braking to a rest and C falling through unsealed into the cut

#### Scenario: Fall identity survives reduced motion
- **WHEN** `prefers-reduced-motion` is set
- **THEN** each fall tier SHALL still play its distinct audio cue even though its motion
  tween is skipped (audio carries the room-vs-world distinction)

### Requirement: Floor crack reads as a bomb target, not a hazard
The floor crack SHALL be rendered so it reads as a place-bombs-here target and not as a
pit the lemming can fall into prematurely. Before the breach, the crack SHALL appear as
fractures drawn over intact, continuous floor with no dark recessed fill; depth SHALL
appear only when the breach opens the pit. A warm-rust accent (the interactive-object
warmth reserved by the palette) SHALL hug the floor seam at the crack's x to disambiguate
"act here" from "hazard".

#### Scenario: No premature pit before the breach
- **WHEN** a cycle is in play before the bombs explode
- **THEN** the floor crack SHALL not render as an open/dark cavity, and no fall hazard SHALL
  exist at the crack until the breach opens the pit
