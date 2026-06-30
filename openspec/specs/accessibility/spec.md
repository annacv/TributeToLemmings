# accessibility

## Purpose

The app's assistive-technology and reduced-motion contract: a single polite live region
that announces dynamic, outcome-bearing run results to screen-reader users; reduced-motion
coverage that extends beyond CSS-clamped durations to rAF-driven canvas and infinite CSS
background motion; and a text-contrast floor on the ranking screen over its scrolling
background.

## Requirements

### Requirement: Dynamic run results are announced to assistive technology
The app SHALL expose a single polite live region (visually hidden, `aria-live="polite"`) through which dynamic, outcome-bearing run results are announced to assistive technology. The animated score count-up and the leaderboard result are otherwise silent to screen-reader users — the live region SHALL announce the final **score** once and the player's **rank** once, conveying the run's outcome without a visible-only dependency. Announcements SHALL convey only settled values (not every intermediate count-up frame) and SHALL each fire once per outcome.

#### Scenario: Final score is announced when the count-up completes
- **WHEN** the Game Over score count-up roll completes
- **THEN** the live region SHALL announce the final score once (e.g. `Score: N`), and SHALL NOT announce each intermediate count-up value

#### Scenario: Final score is announced under reduced motion
- **WHEN** the user prefers reduced motion (the tally renders instantly with no roll)
- **THEN** the live region SHALL announce the final score once, immediately, rather than waiting on a roll that does not run

#### Scenario: Player rank is announced when the ranking resolves
- **WHEN** the Hall of Fame ranking resolves (whether the player is inside or below the top 10)
- **THEN** the live region SHALL announce the player's rank once

#### Scenario: No duplicate announcements
- **WHEN** the ranking re-renders or the retry path runs
- **THEN** each result SHALL be announced at most once per outcome (no repeated or stacked announcements)

### Requirement: Reduced motion covers canvas and background motion, not only CSS animations
Under `prefers-reduced-motion: reduce`, the app SHALL hold all decorative motion at rest — including `requestAnimationFrame`-driven canvas animation and infinite CSS background animations — not only the durations clamped by the global CSS `animation-duration` rule. A motion that the global clamp cannot stop (an rAF loop, or an `infinite` scroll the clamp merely accelerates) SHALL be explicitly stilled.

#### Scenario: Splash mascot holds still under reduced motion
- **WHEN** the start screen mounts and the user prefers reduced motion
- **THEN** the mascot SHALL render a single resting frame and SHALL NOT run its `requestAnimationFrame` idle loop

#### Scenario: Ranking background does not scroll under reduced motion
- **WHEN** the ranking screen is shown and the user prefers reduced motion
- **THEN** the ranking background scroll animation SHALL be stopped (not accelerated to a flicker by the duration clamp)

### Requirement: Ranking text meets contrast over its scrolling background
Text on the ranking screen — including the rank numbers and the loading/empty/error status lines — SHALL meet WCAG 1.4.3 (≥ 4.5:1) against the ranking row background over its scrolling backdrop, accounting for the lightest pixels the row scrim sits over.

#### Scenario: Rank numbers and status text remain legible
- **WHEN** the ranking screen renders rank numbers or a loading/empty/error status line over the moving background
- **THEN** that text SHALL maintain at least 4.5:1 contrast against its row background across the scroll
