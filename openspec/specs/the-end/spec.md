# the-end

## Purpose

The win-path finale screen: the balloon-escape cinematic (lemming boards the resting balloon, then it ascends), the optional no-fail "press to lift off" beat, the skippable credits crawl, the `109_-_Lemmings_-_DOS_-_Tim_2.ogg` loop, reduced-motion/skip resolution, and the route onward to the ranking carrying the unchanged breakdown and submission.

## Requirements

### Requirement: The win path ends in The End finale before the ranking
On a **win** (the Abyss escaped), after the win Game Over tally completes, the run SHALL route to a dedicated **The End** finale screen, and only after the finale SHALL it route to the Hall of Fame ranking. The finale SHALL consume the same `ScoreBreakdown` the Game Over screen received and SHALL forward both that breakdown and the already-created score-submission promise onward to the ranking unchanged. The finale SHALL NOT trigger any additional leaderboard write. The **death** path SHALL be unaffected (death → ranking, as today).

#### Scenario: A win plays the finale, then the ranking
- **WHEN** a run completes the Abyss and the win Game Over tally finishes
- **THEN** The End finale screen SHALL be shown before the ranking, and the ranking SHALL follow it (the finale does not replace the ranking)

#### Scenario: The finale forwards the breakdown and submission, writing nothing extra
- **WHEN** The End routes onward to the ranking
- **THEN** the ranking SHALL receive the same total and submission promise the Game Over screen created, and no additional `submitScore` call SHALL be made by the finale

#### Scenario: Death does not see the finale
- **WHEN** a run ends in death
- **THEN** the Game Over screen SHALL route directly to the ranking with no finale shown

### Requirement: The balloon-escape cinematic boards, then ascends
The finale SHALL play the balloon-escape cinematic in this order: the lemming stands on the grass beside the resting balloon, walks to it, **boards** it (climbs into the basket), and **only then** the balloon **ascends** while the camera follows it upward into the sky (the grass and mountains leaving the bottom of frame, the sky filling). The balloon ascent SFX (`intro-balloon-sound-effect.mp3`) SHALL play **once, at the moment ascent begins** — never at boarding and never before the lemming has boarded. The lemming SHALL be drawn with the shared lemming shape (no new sprite). The balloon SHALL be a renderer-drawn prop over the scene background (not baked into the background art) so it can rest and then rise.

#### Scenario: Boarding precedes ascent and the SFX
- **WHEN** the finale plays
- **THEN** the lemming SHALL board the balloon before the balloon ascends, and `intro-balloon-sound-effect.mp3` SHALL play once at ascent start — not while the lemming is still boarding

#### Scenario: The camera follows the balloon up
- **WHEN** the balloon ascends
- **THEN** the camera SHALL scroll upward to follow it, the grass and mountains leaving frame and the sky filling above

### Requirement: One optional, no-fail lift-off beat
The finale SHALL offer a single optional "press to lift off" beat once the lemming reaches the balloon: pressing the action (SPACE / on-screen action) SHALL trigger boarding immediately. If no press occurs within a short hold, the finale SHALL auto-advance to boarding anyway. The finale SHALL NEVER require input to progress (no soft-lock) and SHALL NEVER gate the win on the press. There SHALL be no collect/inventory/retry mechanic of any kind on the finale.

#### Scenario: Pressing lifts off immediately
- **WHEN** the lift-off prompt is shown and the player presses the action
- **THEN** the lemming SHALL board and the ascent SHALL begin without waiting out the hold

#### Scenario: No press still proceeds
- **WHEN** the lift-off prompt is shown and the player does not press
- **THEN** after the hold the finale SHALL board and ascend on its own (no soft-lock), reaching the ranking

### Requirement: Skippable credits crawl
During and after the ascent the finale SHALL roll a credits crawl over the sky (greetings to the QA testers/personas, audio and asset attribution, and the tribute line), and SHALL auto-advance to the ranking when the crawl completes. The crawl SHALL be skippable: pressing the action/skip input during the ascent or crawl SHALL advance straight to the ranking. The finale SHALL NOT introduce a separate credits screen after the ranking.

#### Scenario: Skipping the crawl goes to the ranking
- **WHEN** the credits crawl is playing and the player presses the skip input
- **THEN** the finale SHALL route immediately to the ranking

### Requirement: The End respects reduced motion and the audio/visibility rules
Under `prefers-reduced-motion` the finale SHALL resolve to its end state (the balloon risen into the sky, the credits readable as static rather than crawling) without depending on the walk, board, ascent, or crawl animations, hold long enough to read, and then route to the ranking. The finale SHALL loop `109_-_Lemmings_-_DOS_-_Tim_2.ogg` on entry, mute-gated by the existing audio-muted preference and paused while the tab is hidden, like every other world loop. The ascent SFX SHALL also obey the mute preference.

#### Scenario: Reduced motion resolves to the ranking
- **WHEN** the user prefers reduced motion
- **THEN** the finale SHALL present its end state (risen balloon, static credits) and route to the ranking without requiring the animated beats

#### Scenario: The finale loop is mute-gated and tab-aware
- **WHEN** the finale screen is shown
- **THEN** `109_-_Lemmings_-_DOS_-_Tim_2.ogg` SHALL loop, respect the mute toggle, and pause while the tab is hidden

#### Scenario: The finale music yields to the ranking
- **WHEN** the finale routes onward to the ranking
- **THEN** the finale loop SHALL stop and the ranking music SHALL start on the ranking screen (one loop playing at a time)
