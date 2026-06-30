# ground-erosion

## Purpose

Ground erosion at the final level: missed bombs progressively crack and hole the ground until full coverage collapses it into the tunnel world transition.

## Requirements

### Requirement: Ground erosion is inactive before the final level
Before the final level activates, missed bombs SHALL exit the canvas without affecting the ground. The `groundErosionActive` flag SHALL be `false` for all levels except the last.

#### Scenario: Missed bomb before the final level leaves ground intact
- **WHEN** a bomb's `dy` exceeds `canvas.height` at any level before the last
- **THEN** the bomb SHALL be removed from the array, no marks SHALL be stamped, and `erosionCounter` SHALL NOT increment

#### Scenario: groundErosionActive becomes true at final level
- **WHEN** the level advances to the final level
- **THEN** `groundErosionActive` SHALL be set to `true` and the vulnerability warning (earthquake shake + warning SFX) SHALL fire

### Requirement: Warning when the final level starts
At the moment `groundErosionActive` becomes true, the game SHALL warn the player that the ground is now vulnerable, before any bomb has actually missed: an earthquake shake on the CRT frame plus a one-shot warning SFX (mute-gated).

#### Scenario: Earthquake warning fires at final level start
- **WHEN** the level advances to the final level
- **THEN** the earthquake shake SHALL trigger and the warning SFX SHALL play once (if not muted)

### Requirement: Missed bombs erode the ground at the final level in phases
While `groundErosionActive` is true, each bomb that exits the bottom of the canvas SHALL increment `erosionCounter` by 1, stamp a crack mark horizontally centered on the impact point, and update the ground visual. The crack variant progresses by miss count: misses 1 to `EARLY_CRACK_MISSES` use crack-mark-1/2 (alternating), every later miss uses crack-mark-3/4 (alternating). From miss `LATE_CRACK_MISSES + 1` on, each miss SHALL additionally stamp a ground hole (4 variants cycling, alternating star-burst and ragged-void styles).

#### Scenario: Missed bomb increments erosion counter
- **WHEN** a bomb's `dy` exceeds `canvas.height` and `groundErosionActive` is true
- **THEN** `erosionCounter` SHALL increment by 1 and the ground erosion visual SHALL update

#### Scenario: Every miss stamps a crack mark aligned with the bomb
- **WHEN** a bomb exits the bottom of the canvas while `groundErosionActive` is true
- **THEN** a crack-mark stamp SHALL be added, horizontally centered under the bomb and contained within the ground band

#### Scenario: Early misses use the light crack variants
- **WHEN** a bomb exits the bottom of the canvas and `erosionCounter <= EARLY_CRACK_MISSES`
- **THEN** the stamp SHALL alternate between crack-mark-1 and crack-mark-2

#### Scenario: Later misses use the heavy crack variants
- **WHEN** a bomb exits the bottom of the canvas and `erosionCounter > EARLY_CRACK_MISSES`
- **THEN** the stamp SHALL alternate between crack-mark-3 and crack-mark-4

#### Scenario: Later misses additionally stamp ground holes
- **WHEN** a bomb exits the bottom of the canvas and `erosionCounter > LATE_CRACK_MISSES`
- **THEN** a ground-hole stamp SHALL be added alongside the crack mark and its footprint SHALL count toward ground coverage

#### Scenario: Ground erosion SFX plays on each chip
- **WHEN** `erosionCounter` increments and audio is not muted
- **THEN** the ground crack SFX SHALL play (reset `currentTime = 0` before play to handle rapid successive misses)

#### Scenario: Caught bombs do not erode the ground
- **WHEN** a bomb collides with the player and explodes
- **THEN** `erosionCounter` SHALL NOT increment regardless of `groundErosionActive` state

### Requirement: Full erosion triggers the tunnel world transition
The game SHALL track how much of the ground band is covered by hole stamps. When coverage reaches `COLLAPSE_COVERAGE` (95%, i.e. 23 of the 24 coverage cells) the game SHALL stamp one final ground hole horizontally centered on the player's current position, bottom-aligned in the ground band, render it, then stop the loop, play the ground collapse sting, and call `triggerTunnelWorld(score)`. The final rendered frame SHALL remain visible briefly before the screen transition: for the duration of the collapse sting when audio is on, or for a short fixed hold (~500 ms) when muted.

#### Scenario: Transition fires when ground coverage reaches 95%
- **WHEN** hole stamps cover at least 95% of the ground band (23 of 24 cells)
- **THEN** the game loop SHALL stop (no further simulation steps), the collapse sting SHALL play (if not muted), and `onTunnelWorld?.(this.score)` SHALL be called

#### Scenario: Coverage below the threshold does not collapse
- **WHEN** hole stamps cover 22 or fewer of the 24 coverage cells
- **THEN** the transition SHALL NOT fire and play continues

#### Scenario: The final hole opens under the lemming
- **WHEN** coverage reaches the collapse threshold
- **THEN** one additional ground-hole stamp SHALL be added, horizontally centered on the player's position and bottom-aligned in the ground band, and it SHALL be visible in the last rendered gameplay frame before the transition

#### Scenario: Muted players perceive the final frame
- **WHEN** the collapse fires while audio is muted
- **THEN** the transition callback SHALL be delayed by a short hold (~500 ms) so the final stamped frame is perceivable before the cut

#### Scenario: Ground collapse sting plays once on full erosion
- **WHEN** the ground is fully eroded and audio is not muted
- **THEN** the collapse sting SHALL play exactly once and SHALL NOT loop

#### Scenario: Erosion state does not persist across game restarts
- **WHEN** a new game starts (via `game.startGame()`)
- **THEN** `erosionCounter` SHALL be 0 and `groundErosionActive` SHALL be false
