# abyss-escape

## Purpose

The Abyss world: a horizontal side-scroll escape corridor entered from the Tunnel via a
door cold-open, with the gather-and-throw stalactite mechanic, three stalactite sizes,
time-gated level progression, the carried-bombs/per-size HUD hint, the Abyss background
loop, and the exit-door close into the `win` ending.

## Requirements

### Requirement: The Abyss opens with a door cold-open
The Abyss SHALL be entered when the Tunnel is cleared: the existing tunnel→Abyss fall transition SHALL land in the Abyss world (not the `win` Game Over). On arrival a closed entrance door SHALL be shown on the ceiling (a renderer-drawn prop over the loaded background — the door is not baked into the background art); the lemming SHALL NOT be visible while the door is closed. After a brief settle hold the game SHALL play `DOOR.WAV` and open the door, the lemming SHALL appear through the opened door, a quick `FALLING` cue SHALL play, and it SHALL drop into the play corridor and land (`THUD.WAV`) — all on the Abyss screen, with no second transition screen. The "How to play" info modal for the Abyss SHALL open over the loaded background.

#### Scenario: Tunnel completion enters the Abyss, not the win screen
- **WHEN** the player clears the final tunnel cycle
- **THEN** the run SHALL route into the Abyss cold-open, and the `win` Game Over SHALL NOT be shown at this point

#### Scenario: The door opens, then the lemming falls in
- **WHEN** the Abyss cold-open plays
- **THEN** the lemming SHALL stay hidden until the door begins to open; `DOOR.WAV` SHALL play and the entrance door SHALL open, then the lemming SHALL appear and fall into the corridor (quick `FALLING` cue, `THUD.WAV` on landing), with no separate transition screen shown for this fall

#### Scenario: Reduced motion still enters cleanly
- **WHEN** the user prefers reduced motion
- **THEN** the cold-open SHALL resolve to the playable corridor (door open, lemming grounded) without depending on the animated beats

### Requirement: The Abyss is a horizontal side-scroll escape corridor
The Abyss SHALL be a horizontal side-scroll corridor: the lemming advances rightward and the camera SHALL scroll to follow it, toward the exit door that is the run's destination. The corridor SHALL have a low ceiling (close to the floor) for tension, ceiling stalactites as the hazards, bombs falling from ceiling trigger zones as the lemming passes, and a ground that starts visually damaged (an erosion callback to Iteration IV). The art SHALL follow the established Abyss direction (red ceiling stalactites, the Lemmings entrance hatch and demon-mouth exit, the wide cavern corridor) per `assets/images/backgrounds/refs/background-{8,10,11}`.

#### Scenario: The lemming advances and the camera follows
- **WHEN** the lemming moves rightward through the corridor
- **THEN** the camera SHALL scroll to keep it in view as it advances toward the exit door

#### Scenario: Hazards are ceiling stalactites and falling bombs
- **WHEN** the lemming traverses the corridor
- **THEN** it SHALL encounter ceiling stalactites overhead and bombs that fall from ceiling trigger zones as it passes beneath them

### Requirement: Gather-and-throw bomb mechanic
Bombs SHALL fall from the ceiling to the floor of the corridor; a bomb that strikes the lemming SHALL cost a life and play a bomb-hit cue (`FIRE.WAV`, as on the Surface). The lemming SHALL move left/right at the shared player speed. Standing on a floor bomb and pressing the action (SPACE / on-screen action) SHALL pick it up, up to a carry cap of 3; picking up SHALL play `EXPLODE.WAV` (the Tunnel's bomb-handling cue). Pressing the action while *near* a stalactite (within a throw range — not only directly beneath it) SHALL throw a carried bomb up at it, also playing `EXPLODE.WAV`; the thrown bomb SHALL be visible travelling up to the stalactite and SHALL land its hit on arrival. A hit SHALL play `MANTRAP.WAV`, show a brief `booom.svg` flash at the impact point, and shake the struck stalactite; destroying a stalactite SHALL play `THUD.WAV` and detach it so it falls and shatters on the floor. A throw with no carried bomb SHALL do nothing. A floor hint SHALL mark the throw spot under any stalactite the lemming is near enough to hit.

#### Scenario: Pick up a floor bomb
- **WHEN** the lemming stands on a fallen bomb and the action is pressed
- **THEN** the bomb SHALL be carried (count increases, up to the carry cap) and `EXPLODE.WAV` SHALL play

#### Scenario: Carry cap is enforced
- **WHEN** the lemming already carries the maximum number of bombs and stands on another floor bomb with the action pressed
- **THEN** the carried count SHALL NOT exceed the cap

#### Scenario: Throw smashes a nearby stalactite
- **WHEN** the lemming carries at least one bomb and the throw action fires near a stalactite (within throw range, not only directly beneath it)
- **THEN** a carried bomb SHALL be spent against the nearest such stalactite — shown travelling up to it before the hit lands (`MANTRAP.WAV` on hit) — and when its required hits are reached the stalactite SHALL be destroyed (`THUD.WAV`)

#### Scenario: The throw spot is hinted and the throw is visible
- **WHEN** the lemming is near a breakable stalactite
- **THEN** a floor hint SHALL mark the throw spot beneath it, and a thrown bomb SHALL be shown in flight up to the stalactite before its hit lands

#### Scenario: Throwing empty-handed does nothing
- **WHEN** the throw action fires with zero carried bombs
- **THEN** no bomb SHALL be thrown and no stalactite SHALL be affected

#### Scenario: A hit shows the booom flash and shake; a non-fatal hit cracks
- **WHEN** a thrown bomb strikes a stalactite that still needs more hits
- **THEN** a brief `booom.svg` flash SHALL show at the impact point, the stalactite SHALL shake, and a crack/chip SHALL mark it as partially broken (without a per-size damaged-state asset)

#### Scenario: A destroyed stalactite falls and shatters
- **WHEN** a stalactite's required hits are reached
- **THEN** `THUD.WAV` SHALL play and the stalactite SHALL detach, fall, and shatter on the floor (non-lethal by default; lethality is a tunable)

### Requirement: Three stalactite sizes with size-scaled cost and score
The Abyss SHALL feature three stalactite sizes (small, medium, large). Larger stalactites SHALL require more bomb hits to destroy and SHALL award more points when destroyed. Each size SHALL have its own pixel-art asset consistent with `bomb.svg`'s style.

#### Scenario: Larger stalactites cost more and score more
- **WHEN** a large stalactite and a small stalactite are each destroyed
- **THEN** the large one SHALL have required more bomb hits and SHALL award more points than the small one

#### Scenario: Break counts are tracked per size
- **WHEN** stalactites of different sizes are destroyed during a run
- **THEN** the run SHALL track the number destroyed of each size independently (for HUD and scoring)

### Requirement: Time-gated level progression mirroring the Surface
The Abyss SHALL run three levels, with every level transition gated on time and a consistent per-level escalation. Level 1 SHALL use the Surface Level-1 pacing and present only small stalactites (1 hit). Each subsequent level SHALL escalate the same way: bomb fall speed and spawn frequency increase, and one additional, larger stalactite size becomes available whose break-cost is one hit higher than the previous largest — Level 2 adds medium stalactites (2 hits; sizes present: small + medium), Level 3 adds large stalactites (3 hits; sizes present: small + medium + large). The run SHALL advance to Level 2 18 seconds after the corridor becomes playable; Level 3 SHALL start 18 seconds after entering Level 2; the run SHALL end 36 seconds after entering Level 3. Breaking stalactites SHALL feed scoring and the HUD, but SHALL NOT gate level progression.

#### Scenario: Level 2 is time-gated from Level 1
- **WHEN** 18 seconds have elapsed in Level 1
- **THEN** the Abyss SHALL advance to Level 2 (more/bigger stalactites, larger ones needing 2 bombs), regardless of how many stalactites have been broken

#### Scenario: Level 3 is time-gated from Level 2
- **WHEN** 18 seconds have elapsed in Level 2
- **THEN** the Abyss SHALL advance to Level 3

#### Scenario: The run ends after the Level-3 budget
- **WHEN** 36 seconds have elapsed in Level 3
- **THEN** the Abyss run SHALL end and route into the exit-door close

#### Scenario: Each level adds one larger size and ramps the bombs
- **WHEN** the Abyss advances from one level to the next
- **THEN** bomb fall speed and spawn frequency SHALL increase, and one additional larger stalactite size SHALL become available (L1 small only → L2 small+medium → L3 small+medium+large), the newest size costing one more hit than the previous largest (1 → 2 → 3)

### Requirement: Carried-bombs and per-size break HUD hint
The Abyss SHALL show a hint in the bottom-left of the play area as inspectable, AA-contrast DOM (not canvas-drawn), laid out in a single row: the carried-bomb count as the bomb sprite followed by `N/cap` text, and the number of stalactites destroyed for each stalactite size available at the current level (sizes not yet in play SHALL be hidden).

#### Scenario: Carried bombs are shown as a sprite and N/cap
- **WHEN** the lemming carries N bombs
- **THEN** the hint SHALL show the bomb sprite followed by `N/cap` (e.g. `3/10`)

#### Scenario: Per-size break counts are shown for the current level only
- **WHEN** stalactites have been destroyed
- **THEN** the hint SHALL show the destroyed count for each size available at the current level, and SHALL NOT show sizes that have not yet entered play

### Requirement: Abyss background loop and audio gating
On entering the Abyss the game SHALL start a looping background track (`121_-_Lemmings_-_DOS_-_Awesome.ogg`), faster and more driving than the tunnel loop. The loop and all Abyss SFX SHALL respect the existing mute toggle and SHALL pause while the tab is hidden, consistent with the other worlds.

#### Scenario: The Abyss loop respects mute
- **WHEN** the player has muted audio
- **THEN** the Abyss background loop SHALL not be audible, matching the other worlds' mute behavior

#### Scenario: The loop pauses with a hidden tab
- **WHEN** the tab is hidden during an Abyss run
- **THEN** the Abyss loop SHALL pause and resume on return, and a dead run SHALL NOT resume over the next screen

### Requirement: The Abyss closes through the exit door into the win
When the Abyss run ends, an exit door SHALL appear (the original-Lemmings exit-door language); the lemming SHALL move to it and disappear into it; `LETSGO.WAV` SHALL play as it enters; then the run SHALL route to the `win` Game Over tally and onward to the Ranking screen.

#### Scenario: Exit door closes the world
- **WHEN** the Abyss run ends
- **THEN** an exit door SHALL appear, the lemming SHALL vanish into it, `LETSGO.WAV` SHALL play, and the run SHALL proceed to the `win` Game Over screen

#### Scenario: Win routes to ranking
- **WHEN** the Abyss `win` Game Over tally completes
- **THEN** the run SHALL proceed to the Ranking screen as today (Reed-Flutes ranking music; no separate win track)
