// Song catalogue + beatmap generation. Treats are derived from the actual MIDI
// melody (channel 0): lower-pitched notes fall on the left lane, higher on the
// right — matching the low/high duet the two dogs sing. Decoys (don't-catch
// treats) are sprinkled between notes for harder songs. A tiny procedural
// fallback keeps the game playable if a .mid fails to load.

const TREATS = ['🦴', '🍖', '🍗', '🧀', '🍩', '🍪', '🍣', '🥩'];
const DECOY = '🌶️';

// Built-in tracks are public-domain melodies transcribed in tools/build-midi.mjs.
export const SONGS = [
  {
    id: 'ode-to-joy', title: 'Ode to Joy', subtitle: 'Easy · Beethoven',
    file: 'assets/music/ode-to-joy.mid', bpm: 100, fallTime: 2.0,
    difficulty: 'Easy', decoyChance: 0, theme: '🌻',
  },
  {
    id: 'entertainer', title: 'The Entertainer', subtitle: 'Medium · Joplin',
    file: 'assets/music/entertainer.mid', bpm: 110, fallTime: 1.7,
    difficulty: 'Medium', decoyChance: 0.1, theme: '🎹',
  },
  {
    id: 'mountain-king', title: 'Hall of the Mountain King', subtitle: 'Hard · Grieg',
    file: 'assets/music/mountain-king.mid', bpm: 138, fallTime: 1.45,
    difficulty: 'Hard', decoyChance: 0.18, theme: '⛰️',
  },
];

export function getSong(id) {
  return SONGS.find((s) => s.id === id) || SONGS[0];
}

// notes: parsed MIDI notes already shifted by the intro offset (so note.time is
// the game-time at which the treat should be caught). Each treat gets a side
// (0 left dog / 1 right dog) and slot (0 / 1 — the dog's two positions), derived
// from the melody's pitch contour. Returns { notes, duration }.
export function buildBeatmapFromMidi(notes, song) {
  const mel = notes.filter((n) => n.chan === 0).sort((a, b) => a.time - b.time);
  if (!mel.length) return buildFallback(song);

  // Map pitch to one of 4 columns by quartile: lowest→col0 … highest→col3.
  const pitches = mel.map((n) => n.midi).sort((a, b) => a - b);
  const q = (f) => pitches[Math.floor(f * (pitches.length - 1))];
  const q1 = q(0.25); const q2 = q(0.5); const q3 = q(0.75);
  const colOf = (m) => (m <= q1 ? 0 : m <= q2 ? 1 : m <= q3 ? 2 : 3);
  const slideTime = 1 / 6; // a dog needs ~this long to cross between its slots

  const lastBySide = [-Infinity, -Infinity];
  const lastSlot = [0, 1];
  const treats = [];
  let i = 0;
  for (const n of mel) {
    const col = colOf(n.midi);
    const side = col < 2 ? 0 : 1;
    const slot = col % 2;
    // Drop a note only if it would force the same dog to teleport across slots
    // faster than it can slide — keeps the chart fair and the melody intact.
    if (slot !== lastSlot[side] && n.time - lastBySide[side] < slideTime) continue;
    lastBySide[side] = n.time;
    lastSlot[side] = slot;
    treats.push({
      side, slot, time: n.time, type: 'good',
      emoji: TREATS[i++ % TREATS.length], midi: n.midi, dur: n.dur,
    });
  }

  if (song.decoyChance > 0) addDecoys(treats, song, mel);

  const lastTime = mel[mel.length - 1].time;
  return { notes: treats, duration: lastTime + song.fallTime + 1.8, fallTime: song.fallTime };
}

function addDecoys(treats, song, mel) {
  const rng = mulberry32(hash(song.id) ^ 0x9e3779b9);
  const step = 60 / song.bpm / 2; // eighth-note grid
  const start = mel[0].time;
  const end = mel[mel.length - 1].time;
  const minGap = 0.22;
  const near = (t, side, slot) =>
    treats.some((x) => x.side === side && x.slot === slot && Math.abs(x.time - t) < minGap);
  for (let t = start; t < end; t += step) {
    if (rng() > song.decoyChance) continue;
    const side = rng() < 0.5 ? 0 : 1;
    const slot = rng() < 0.5 ? 0 : 1;
    if (near(t, side, slot)) continue;
    treats.push({ side, slot, time: t, type: 'decoy', emoji: DECOY });
  }
  treats.sort((a, b) => a.time - b.time);
}

// Fallback chart (used only if the MIDI can't be loaded). No source notes, so
// catches use the pentatonic catch sound instead of melody notes.
function buildFallback(song) {
  const rng = mulberry32(hash(song.id));
  const step = 60 / song.bpm / 2;
  const notes = [];
  let col = 0;
  for (let i = 0; i < 64; i++) {
    if (rng() > 0.6) continue;
    if (rng() < 0.6) col = (col + 1 + Math.floor(rng() * 3)) % 4;
    notes.push({
      side: col < 2 ? 0 : 1, slot: col % 2,
      time: song.fallTime + 2 + i * step, type: 'good',
      emoji: TREATS[i % TREATS.length],
    });
  }
  const lastTime = song.fallTime + 2 + 64 * step;
  return { notes, duration: lastTime + song.fallTime + 1.5, fallTime: song.fallTime };
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
