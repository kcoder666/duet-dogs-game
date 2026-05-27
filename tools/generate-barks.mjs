// Dev script: generates one realistic, character-matched dog bark per pup using
// the ElevenLabs Sound Effects API, saved to assets/sfx/<id>.mp3.
//
// Setup: put your key in a gitignored .env at the repo root:
//   ELEVENLABS_API_KEY=sk_...
// Then run:  node tools/generate-barks.mjs   (or: make barks)
//
// The game falls back to synthesized barks if these files are absent, so this
// is purely an enhancement.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'sfx');

// Per-character SFX prompts tuned to each breed's personality.
const BARKS = [
  { id: 'max', dur: 0.9, prompt: 'A single friendly warm bark from a happy golden retriever, medium pitch, cheerful, dry studio recording, no music, no reverb' },
  { id: 'rocky', dur: 1.3, prompt: 'A playful husky howl-bark, short "awoo" woo sound, energetic, dry studio recording, no music' },
  { id: 'oscar', dur: 0.8, prompt: 'A calm polite single soft "boof" bark from a border collie, low and gentle, dry studio recording, no music' },
  { id: 'buddy', dur: 1.0, prompt: 'Two quick excited high-energy yip-barks from an eager corgi puppy, bright, dry studio recording, no music' },
  { id: 'bella', dur: 0.9, prompt: 'Two dainty high-pitched cute yips from a small poodle, delicate, dry studio recording, no music' },
];

function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const envPath = join(ROOT, '.env');
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, 'utf8').match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return null;
}

async function generate(key, bark) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: bark.prompt,
      duration_seconds: bark.dur,
      prompt_influence: 0.6,
    }),
  });
  if (!res.ok) throw new Error(`${bark.id}: HTTP ${res.status} ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const out = join(OUT, `${bark.id}.mp3`);
  writeFileSync(out, buf);
  console.log(`wrote ${bark.id}.mp3 (${(buf.length / 1024).toFixed(1)} KB)`);
}

const key = loadKey();
if (!key) {
  console.error('Missing ELEVENLABS_API_KEY. Add it to .env (ELEVENLABS_API_KEY=...) or export it.');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
for (const bark of BARKS) {
  try { await generate(key, bark); } catch (e) { console.error('FAILED', e.message); }
}
console.log('Done. Hard-refresh the game (⌘⇧R) to hear the new barks.');
