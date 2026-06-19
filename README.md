# Tribute to Lemmings

> A retro pixel-art browser game where you skip and escape, stay alive, and climb the leaderboard.

## Description

A loving tribute to DMA Design's classic 1991 *Lemmings* — built as if its bonus screen grew into a game of its own. Guide a single lemming through an escalating run: **skip and escape**, **stay alive** as the world turns against you, and **climb the leaderboard** against everyone else who tried.

It's a tribute first and a score-chase second. Each world reinterprets the original's mood — the Surface, the Tunnel, the Abyss — and ties back to the iconography fans remember: the explosions, the doors, the balloon.

## The two-world arc

The run is a continuous journey across linked worlds, with score banking across the whole arc.


| World              | Status      | What you do                                                                                                                                                                       |
| ------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟦 **The Surface** | ✅ Playable  | Dodge falling bombs with ← → as levels escalate. The ground cracks and erodes until it collapses beneath you.                                                                     |
| 🟫 **The Tunnel**  | ✅ Playable  | Trapped underground. Pick up unexploded bombs, find the crack in the wall, light the fuse, and breach your way out across three cycles — before the lowering ceiling crushes you. |
| ⬛ **The Abyss**    | 🚧 Roadmap  | A horizontal escape through a hazard-lined corridor toward the iconic exit door, capped by the balloon cinematic.                                                                 |
| 🎬 **The End**     | 🗺️ Planned | A dedicated finale screen — the win payoff and emotional close of the full game.                                                                                                  |


Death routes to **Game Over** with your banked score; a successful escape carries you onward to the **Ranking** (global top-10 leaderboard).

## Tech stack


| Area        | Choice                                                             |
| ----------- | ------------------------------------------------------------------ |
| Language    | TypeScript (strict)                                                |
| Rendering   | HTML5 Canvas — characters, hazards, and backgrounds drawn directly |
| Build       | Vite                                                               |
| Tests       | Vitest (+ jsdom)                                                   |
| Leaderboard | Firebase (Firestore free tier)                                     |
| Lint        | `tsc --noEmit` + ESLint + Prettier                                 |
| Workflow    | Spec-driven via [OpenSpec](openspec/), one iteration per change    |


## Project structure

```
assets/
  ts/
    main.ts                 # Bootstraps the app, screen routing, splash + info modals
    SurfaceGame.ts          # The Surface world (loop, state, transitions)
    SurfaceRenderer.ts      # Surface draw layer
    TunnelGame.ts           # The Tunnel world (loop, state, transitions)
    TunnelRenderer.ts       # Tunnel draw layer
    Player.ts  Bomb.ts      # Core entities
    assets.ts               # Asset references
    lib/
      GameLoop.ts           # Fixed-timestep loop
      RunLifecycle.ts       # Shared run/score lifecycle glue
      score.ts  Hud.ts      # Scoring + HUD
      audio.ts  SoundEffectBank.ts
      firebase.ts  leaderboard.ts
      fx.ts  geometry.ts  images.ts
  css/  fonts/  images/  sounds/
index.html                  # Shell: header, <main> mount, footer
openspec/                   # Specs + iteration changes (active & archived)
public/                     # og-image and static assets
```

## Roadmap

The build runs one iteration at a time, spec-first. Iterations I–V have shipped; VI–VII are next.

**Shipped — Iterations I–V**


| #   | Iteration                           | Delivered                                                                                                                                                                                                                                              |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I   | Visual Foundations & Brand Identity | Layered SVG backgrounds, branded splash hero, CRT bezel, responsive canvas, canvas-drawn lemming with per-health color, blink-on-hit, hair animation, directional flip, lives icons.                                                                   |
| II  | Global Leaderboard                  | Optional name input (guest fallback), Firestore writes on game over, global top-10 Ranking screen with the player's row/position highlighted, data notice.                                                                                             |
| III | Sound & Music                       | Bomb-hit SFX, game-over sting, ranking ambient, all gated by the existing mute preference; assets from the Lemmings DOS OST.                                                                                                                           |
| IV  | Level Progression & Ground Erosion  | Three-level difficulty ramp, level-transition UI/audio, level-gated ground erosion (cracks → holes → collapse), last-level earthquake warning, cumulative time-based scoring, collapse transition into the Tunnel.                                     |
| V   | Tunnel Escape Puzzle                | Underground screen with info modal, bomb pickup + crack-finding + fuse-lighting across three cycles, lowering-ceiling crush death + respawn, Tunnel→Abyss collapse transition, full both-worlds scoring breakdown, distinct background loop + SFX set. |


### Iteration VI — The Abyss: Horizontal Escape

A horizontal side-scroll escape through an underground corridor toward the exit door.
Art inspiration refs: `assets/images/backgrounds/refs/background-8.png`, `background-10.png`, `background-11.jpg`.

1. Cold open (door-in/door-out tribute, ratified in V's round-4 review): the Abyss arrival beat shows the lemming finding a closed door and entering the new world through it — doors open the chapter that THE exit door will close.
2. Horizontal rightward scroll: the lemming advances right through the corridor toward the iconic exit door (referencing the original Lemmings game) as the win condition.
3. Hazards along the corridor: stalactites as fixed ceiling obstacles the player navigates around; bombs fall from trigger zones as the player passes beneath them — two distinct hazard types, not simultaneous falling objects.
4. Player must dodge all hazards and reach the door to complete the screen. Ceiling sits close to the floor to maintain tension.
5. Ground starts visually damaged as a narrative callback to the erosion in Iteration IV.
6. New abyss-world SVG background designed for the underground setting.
7. On reaching the door: a brief (3–5s) non-interactive balloon escape cinematic plays — the lemming is lifted by the hot air balloon from the original Lemmings before the Ranking screen fades in.
8. Audio — new looping background track on screen entry: faster and more driving than the tunnel track to convey chase energy.
9. Audio — stalactite collision SFX (one-shot crunch on hit); door reached sting (triumphant one-shot on win condition); balloon cinematic track: the most iconic available Lemmings DOS OST cue, used as the emotional peak and payoff of the full game.

### Iteration VII — The End

A dedicated finale screen: the emotional close and win payoff of the full game. Split out from the Abyss (VI) on purpose so the ending — the screen players carry away — gets its own focus instead of being crammed into VI's plate.

1. Dedicated `TheEnd` screen with its own background art and dramaturgy (composition, pacing, copy, and likely a dedicated music cue).
2. Formalises the win ending: today the win routes through the parameterized `GAME OVER` *win* variant; `THE END` becomes a bespoke screen that replaces (or sits just ahead of) it — the exact placement relative to the Abyss balloon cinematic and the ranking is a scope-time decision. Death keeps the `GAME OVER` screen.
3. Sequencing & gate: ships after the Abyss (VI) — it is the beat the player reaches once the Abyss escape completes — and is blocked on the dedicated background artwork being provided (not generated).

## Development

### Prerequisites

Node 18+ and npm 9+.

### Setup

```bash
npm install
```

### Commands


| Command         | Description                                          |
| --------------- | ---------------------------------------------------- |
| `npm run dev`   | Start the Vite dev server at `http://localhost:5173` |
| `npm run build` | Bundle for production into `dist/`                   |
| `npm test`      | Run the Vitest test suite                            |
| `npm run lint`  | Type-check with `tsc` and lint with ESLint           |


> **Note:** Open the game via `npm run dev`, not by double-clicking `index.html` — the file must be served through Vite for ES modules and asset paths to resolve correctly.

## Credits

Audio comes from two fan-tribute sources, both chosen for tonal and legal consistency with the tribute concept:

- The original **Lemmings DOS OST** — the music loops and the `.WAV` SFX set.
- A set of **modern Lemmings voices** — the two `intro-` cues, cut from the *"Lemmings Voice Evolution! (1991–2021)"* compilation and distributed via [101soundboards](https://www.101soundboards.com/boards/76128-lemmings-soundboard) / [Voicy](https://www.voicy.network/official-soundboards/games/lemmings).

**Music & loops**


| File                                                 | Used for                       |
| ---------------------------------------------------- | ------------------------------ |
| `03_-_Lemmings_-_DOS_-_Lemming_2.ogg`                | Surface background music       |
| `113_-_Lemmings_-_DOS_-_Tim_5.ogg`                   | Tunnel / underground cave loop |
| `14_-_Lemmings_-_DOS_-_Dance_of_the_Reed-Flutes.ogg` | Ranking (Hall of Fame) screen  |


**Sound effects (DOS SFX set)**


| File           | Used for                                                         |
| -------------- | ---------------------------------------------------------------- |
| `FIRE.WAV`     | Surface bomb hit · Tunnel fuse burn                              |
| `YIPPEE.WAV`   | Surface level-up cue                                             |
| `ELECTRIC.WAV` | Surface last-level warning (ground-vulnerable / earthquake beat) |
| `BANG.WAV`     | Bomb breaks earth — Surface ground crack · Tunnel breach         |
| `TENTON.WAV`   | Earth comes down — Surface collapse sting · Tunnel ceiling crush |
| `DIE.WAV`      | Death Game Over sting                                            |
| `EXPLODE.WAV`  | Tunnel bomb pickup                                               |
| `SCRAPE.WAV`   | Tunnel match-strike (fuse-light press)                           |
| `CHAIN.WAV`    | Tunnel ceiling-lower grinding rumble                             |
| `TING.WAV`     | Game Over score-tally tick                                       |
| `MOUSEPRE.WAV` | Game Over score-total chime                                      |


**Modern Lemmings voices** (101soundboards / Voicy — *not* DOS OST)


| File                             | Used for                                                |
| -------------------------------- | ------------------------------------------------------- |
| `intro-falling-sound-effect.mp3` | World-boundary fall cue (Surface→Tunnel · Tunnel→Abyss) |
| `intro-balloon-sound-effect.mp3` | Balloon-escape cinematic (Iteration VI — not yet wired) |


All audio respects the in-game mute toggle and pauses when the tab is hidden.

## Links

- **Repo** — [https://github.com/annacv/TributeToLemmings](https://github.com/annacv/TributeToLemmings)
- **Play** — [https://annacv.github.io/TributeToLemmings/](https://annacv.github.io/TributeToLemmings/)

