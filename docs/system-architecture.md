# System Architecture — Duet Dogs

MVP HTML5 rhythm game. Vanilla ES modules, single `<canvas>`, no build/deps.

## Module map

| Module | Responsibility | DOM/Browser deps |
|--------|----------------|------------------|
| `config.js` | Brand palette, timing windows, scoring/rank math | none (pure) |
| `beatmap.js` | Song catalogue + deterministic chart generation | none (pure) |
| `characters.js` | ScoutPaw pack data + `drawDog()` canvas renderer | canvas ctx |
| `audio.js` | Web Audio backing track, duet catch notes, SFX | AudioContext |
| `renderer.js` | Per-frame canvas draw of state | canvas ctx |
| `input.js` | touch/mouse/keyboard → `onTap(lane)` | DOM events |
| `game.js` | Run state machine, judging, scoring, particles, loop | canvas (via renderer) |
| `ui.js` | Screen flow markup + dog previews | DOM |
| `main.js` | Wiring, high-DPI canvas fit, screen handlers | DOM |

Flow: `main` wires `audio` + `game` + `ui` + `input`. UI emits intents
(`onPlay/onSong/onStart/onRetry/onMenu`); `game.onEnd(result)` → `ui.showResults`.

## Timing model (the critical bit)

The **audio clock is the source of truth**, not `requestAnimationFrame`.

- `audio.startMusic()` returns `musicStart` (an `AudioContext.currentTime`).
- `game.audioTime = audio.now() - musicStart` is the play position in seconds.
- Each beatmap note has a `time` = the exact play-position it should be caught.
- A note's on-screen Y is interpolated from
  `progress = (audioTime - (note.time - fallTime)) / fallTime` (0 = top, 1 = hit line),
  so visuals are derived from audio time → audio/video stay locked even if frames drop.
- Music is queued by a 25 ms-interval **lookahead scheduler** (standard Web Audio
  pattern) on an eighth-note grid derived from the song BPM.

## Judging

On `tap(lane)`: pick the nearest unjudged note in that lane; `dt = |audioTime - note.time|`.
- `dt ≤ 0.075s` → **Perfect**, `≤ 0.15s` → **Good**, else wasted tap (no penalty).
- Tapping a **decoy** in window → penalty (combo reset, happiness loss).
- Notes passing `+0.15s` unjudged: a good note auto-**misses**; a decoy passing is correct.

Scoring: `base(100/50) × comboMultiplier` (+0.5× per 8 combo, cap 4×).
Happiness meter (start 100) is the lives system; reaching 0 ends the run.
Accuracy = perfects+goods / total-good-notes → rank S/A/B/C/D.

## Native-port seams

- All gameplay logic is DOM-free except the injected canvas ctx + AudioContext.
- `window.duetDogs = { game, audio, ui }` is the debug/automation + native bridge hook.
- No bundler required; assets are procedural (drawn dogs, synthesized audio).

## Unresolved / future

- Persistence (high scores) — none yet (no `localStorage`).
- Real licensed music tracks if richer audio is wanted for production.
- Remove/guard `window.duetDogs` before a hardened production release.
