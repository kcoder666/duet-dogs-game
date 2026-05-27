# Duet Dogs 🐾🎵

A mobile-first HTML5 rhythm game — a *Duet Cats*-style "catch treats on the beat"
game reskinned with the **ScoutPaw** pack of cartoon dogs. Two pups sit at the
bottom of the screen (one per lane); treats fall to the beat and you tap each
side in time to catch them. Every catch plays a pentatonic note — left pup low,
right pup high — so your duet literally sings together.

Built as an MVP with zero build step and zero external assets, so it can later be
wrapped into a native iOS/Android shell (Capacitor / WKWebView / WebView).

## Play

```bash
# Any static server works (ES modules require http://, not file://)
python3 -m http.server 8765
# then open http://localhost:8765
```

**Controls**
- **Touch / mouse:** tap the left half for the left pup, right half for the right pup.
- **Keyboard:** `F` / `←` = left, `J` / `→` = right.

**Goal:** catch falling treats right as they reach each dog. Judged **Perfect**
(±75 ms) or **Good** (±150 ms). Build combos for a score multiplier (up to 4×).
Missing treats — or catching a 🌶️ decoy — drains the Happiness meter; empty it and
the pups get grumpy and the run ends. Let decoys fall past safely.

## The pack (from [scoutpaw.tv](https://www.scoutpaw.tv/))

Max (Golden Retriever) · Rocky (Husky) · Oscar (Collie) · Buddy (Corgi) · Bella (Poodle).
Pick any two as your duet. Dog art is original, drawn parametrically on canvas in
the ScoutPaw brand palette (cream / brown / gold / husky-blue, Fredoka + Nunito).

## Tracks

| Track | Difficulty | BPM | Notes |
|-------|-----------|-----|-------|
| Puppy Park | Easy | 96 | no decoys |
| Treat Street | Medium | 116 | some decoys |
| Midnight Zoomies | Hard | 140 | dense + decoys |

Each track is a real **MIDI file** (`assets/music/*.mid`): the engine parses it,
plays the melody/bass through a Web Audio synth, and **builds the falling-treat
chart from the song's actual notes** (low notes → left lane, high → right). The
tunes are original, algorithmically composed pop-style loops — see
`tools/build-midi.mjs` (run `node tools/build-midi.mjs` to regenerate). Drop your
own licensed `.mid` into `assets/music/` and point a song entry at it to add tracks.

> Note: current chart hits can't be bundled — a pop song's melody is copyrighted —
> so the built-in tracks are original compositions.

## Tech & structure

Vanilla HTML5 Canvas + ES modules. No framework, no dependencies, no build.

```
index.html            # shell, fonts, viewport
css/styles.css        # mobile-first, brand styling
js/
  config.js           # palette, timing windows, scoring rules
  characters.js       # ScoutPaw pack data + parametric canvas dog renderer
  midi.js             # Standard MIDI File parser (.mid → timed notes)
  audio.js            # Web Audio engine: MIDI melody/bass + drums + catch SFX
  beatmap.js          # song catalogue + chart built from MIDI melody notes
  input.js            # touch / mouse / keyboard → lane taps
  renderer.js         # canvas frame drawing (lanes, treats, dogs, guides, HUD, FX)
  game.js             # loads MIDI, run state machine, judging, scoring, particles
  ui.js               # DOM screens: title / song select / duet picker / results
  main.js             # bootstrap + high-DPI canvas fit
tools/
  build-midi.mjs      # dev script: composes original .mid tracks
assets/music/*.mid    # generated MIDI tracks
```

## Porting to native later

- The play field is one `<canvas>`; logic in `game.js`/`audio.js`/`beatmap.js` is
  DOM-free aside from the injected canvas + AudioContext — wrap with Capacitor or a
  native WebView with minimal change.
- `window.duetDogs = { game, audio, ui }` is exposed as a debug/automation seam and
  a convenient bridge point for native hooks.
- Timing is driven by `AudioContext.currentTime`, the right clock for a native port.

## Credits

Characters & brand inspired by ScoutPaw TV. Gameplay inspired by *Duet Cats*. All
code and art in this repo are original.
