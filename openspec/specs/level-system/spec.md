# level-system

## Purpose

Difficulty progression: per-level spawn intervals and bomb speeds, score-threshold level advancement, deterministic spawning, and level-up HUD/audio feedback.

## Requirements

### Requirement: Level config defines spawn interval and bomb speed per level
The game SHALL define difficulty as a fixed array of level configs. Each entry SHALL specify `spawnIntervalFrames` (minimum frames between consecutive bomb spawns) and `bombSpeed` (pixels per frame for newly created bombs). The array SHALL contain between 3 and 5 entries. The final entry is the last level.

#### Scenario: Level 1 starts with a 1-second spawn interval
- **WHEN** the game starts
- **THEN** the first bomb SHALL NOT spawn until at least 60 frames (≈1 s at 60 fps) have elapsed

#### Scenario: Bomb speed increases with each level
- **WHEN** a new bomb is created at level N
- **THEN** its speed SHALL equal `LEVEL_CONFIG[N].bombSpeed`, which SHALL be greater than `LEVEL_CONFIG[N-1].bombSpeed` for every level beyond the first

#### Scenario: Spawn interval decreases with each level
- **WHEN** a new bomb is created at level N
- **THEN** the interval since the previous spawn SHALL be at least `LEVEL_CONFIG[N].spawnIntervalFrames`, which SHALL be less than `LEVEL_CONFIG[N-1].spawnIntervalFrames` for every level beyond the first

### Requirement: Level advances at score thresholds
The game SHALL advance to the next level when `score >= LEVEL_THRESHOLDS[currentLevel + 1]`. Score is measured in whole seconds (existing formula: `count % 60 === 0` increments score). Level advancement SHALL only occur if a next level exists in the config array.

#### Scenario: Level advances when the score threshold is reached
- **WHEN** the player's score reaches the threshold defined for the next level
- **THEN** `currentLevel` SHALL increment by 1, level-up feedback SHALL fire, and subsequently spawned bombs SHALL use the new level's config

#### Scenario: Level does not advance past the final level
- **WHEN** the player's score exceeds any value while already at the last level index
- **THEN** `currentLevel` SHALL remain at the last index and no further advancement SHALL occur

#### Scenario: Level resets to 0 on game start
- **WHEN** `game.startGame()` is called
- **THEN** `currentLevel` SHALL be 0 and spawn behaviour SHALL use `LEVEL_CONFIG[0]`

### Requirement: Deterministic frame-interval bomb spawning
The game SHALL spawn bombs based on a frame counter, not random probability. A bomb SHALL be created when `count - lastSpawnFrame >= currentLevelConfig.spawnIntervalFrames`. `lastSpawnFrame` SHALL be updated to `count` immediately after each spawn.

#### Scenario: Exactly one bomb spawns per interval
- **WHEN** `count - lastSpawnFrame` first equals `spawnIntervalFrames`
- **THEN** exactly one bomb SHALL be added to the bombs array and `lastSpawnFrame` SHALL be set to `count`

#### Scenario: lastSpawnFrame resets on level-up
- **WHEN** the level advances
- **THEN** `lastSpawnFrame` SHALL be set to `count` so the next bomb spawns one full interval after the level-up, not immediately

#### Scenario: In-flight bombs keep their original speed after level-up
- **WHEN** the level advances while bombs are already in flight
- **THEN** those existing bombs SHALL retain the speed they were created with; only newly created bombs SHALL use the new level's speed

### Requirement: Level-up HUD and audio feedback
On each level advance the game SHALL update the HUD to display the new level number and play a short level-up SFX sourced from the Lemmings DOS OST. The SFX SHALL respect the existing mute gate (`gameSong.muted`).

#### Scenario: HUD shows current level
- **WHEN** the game screen is active
- **THEN** the HUD SHALL display the current level number (1-indexed) at all times

#### Scenario: Level 1 is announced at game start
- **WHEN** the game starts
- **THEN** the level banner SHALL display "Level 1" and no level-up SFX SHALL play

#### Scenario: Level-up SFX plays on advance
- **WHEN** the level advances and audio is not muted
- **THEN** the level-up SFX SHALL play once

#### Scenario: Level-up SFX is silent when muted
- **WHEN** the level advances and `gameSong.muted` is true
- **THEN** no level-up SFX SHALL play
