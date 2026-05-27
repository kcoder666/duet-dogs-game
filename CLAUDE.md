# Duet Dogs — project rules

## Git / deploy
- **Do NOT auto-push.** Commit and `git push` only when the user explicitly
  asks ("push", "ship", "deploy"). The user tests locally first.
- Local test: `make run` (or `python3 -m http.server`) → open the localhost URL,
  hard-refresh (⌘⇧R) to bypass cached JS/CSS.
- Live site is GitHub Pages (`https://kcoder666.github.io/duet-dogs-game/`),
  which rebuilds on push to `main`.

## Project shape
- Vanilla HTML5 Canvas + ES modules, no build step. Static files only.
- Music: MIDI-driven (`assets/music/*.mid` from `tools/build-midi.mjs`); tracks
  are public-domain melodies. Audio + barks synthesized via Web Audio.
- See `README.md` and `docs/system-architecture.md` for details.
