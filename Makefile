# Duet Dogs — dev tasks. Static site, no build step.
PORT ?= 3000

.PHONY: run midi gen-barks

# Serve the game locally over HTTP (ES modules + .mid need http://, not file://).
run:
	npx serve . -l $(PORT)

# Regenerate the public-domain MIDI tracks into assets/music/.
midi:
	node tools/build-midi.mjs

# Generate per-dog bark SFX into assets/sfx/ (needs ELEVENLABS_API_KEY in .env).
gen-barks:
	node tools/generate-barks.mjs
