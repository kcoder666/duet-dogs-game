// Song catalogue + beatmap generation. Treats are derived from the actual MIDI
// melody (channel 0): lower-pitched notes fall on the left lane, higher on the
// right — matching the low/high duet the two dogs sing. Decoys (don't-catch
// treats) are sprinkled between notes for harder songs. A tiny procedural
// fallback keeps the game playable if a .mid fails to load.

const TREATS = ['🦴', '🍖', '🍗', '🧀', '🍩', '🍪', '🍣', '🥩'];
const DECOY = '🌶️';

export const SONGS = [
  {
    id: 'puppy-park', title: 'Puppy Park', subtitle: 'Easy · 96 BPM',
    file: 'assets/music/puppy-park.mid', bpm: 96, fallTime: 2.0,
    difficulty: 'Easy', decoyChance: 0, theme: '🌳',
  },
  {
    id: 'treat-street', title: 'Treat Street', subtitle: 'Medium · 116 BPM',
    file: 'assets/music/treat-street.mid', bpm: 116, fallTime: 1.7,
    difficulty: 'Medium', decoyChance: 0.1, theme: '🏙️',
  },
  {
    id: 'midnight-zoomies', title: 'Midnight Zoomies', subtitle: 'Hard · 140 BPM',
    file: 'assets/music/midnight-zoomies.mid', bpm: 140, fallTime: 1.45,
    difficulty: 'Hard', decoyChance: 0.18, theme: '🌙',
  },
];

export function getSong(id) {
  return SONGS.find((s) => s.id === id) || SONGS[0];
}

// notes: parsed MIDI notes already shifted by the intro offset (so note.time is
// the game-time at which the treat should be caught). Returns { notes, duration }.
export function buildBeatmapFromMidi(notes, song) {
  const mel = notes.filter((n) => n.chan === 0).sort((a, b) => a.time - b.time);
  if (!mel.length) return buildFallback(song);

  const pitches = mel.map((n) => n.midi).sort((a, b) => a - b);
  const threshold = pitches[Math.floor(pitches.length / 2)]; // median split
  const minGap = 0.14;
  const last = [-Infinity, -Infinity];
  const treats = [];
  let i = 0;
  for (const n of mel) {
    let lane = n.midi < threshold ? 0 : 1;
    if (n.time - last[lane] < minGap) {
      const other = 1 - lane;
      if (n.time - last[other] >= minGap) lane = other;
      else continue; // too dense on both lanes — drop this note as a treat
    }
    last[lane] = n.time;
    treats.push({ lane, time: n.time, type: 'good', emoji: TREATS[i++ % TREATS.length] });
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
  const minGap = 0.2;
  const isNear = (t, lane) => treats.some((x) => x.lane === lane && Math.abs(x.time - t) < minGap);
  for (let t = start; t < end; t += step) {
    if (rng() > song.decoyChance) continue;
    const lane = rng() < 0.5 ? 0 : 1;
    if (isNear(t, lane)) continue;
    treats.push({ lane, time: t, type: 'decoy', emoji: DECOY });
  }
  treats.sort((a, b) => a.time - b.time);
}

// Pure-synth fallback chart (used only if the MIDI can't be loaded).
function buildFallback(song) {
  const rng = mulberry32(hash(song.id));
  const step = 60 / song.bpm / 2;
  const notes = [];
  let lane = 0;
  for (let i = 0; i < 64; i++) {
    if (rng() > 0.6) continue;
    lane = rng() < 0.6 ? 1 - lane : lane;
    notes.push({
      lane, time: song.fallTime + 2 + i * step, type: 'good',
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
