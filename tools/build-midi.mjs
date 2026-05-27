// Dev script: transcribes three PUBLIC-DOMAIN melodies into real .mid files in
// assets/music/. Run once with `node tools/build-midi.mjs`; commit the output.
// The underlying compositions are public domain (composers died 100+ years ago)
// so transcribing their melodies is free of copyright. Melodies are encoded by
// hand here (not copied from any third-party MIDI arrangement).
//
//   channel 0 = melody  (becomes the catchable treats)
//   channel 1 = bass    (accompaniment only)

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PPQ = 480;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'music');

// --- melody helpers -------------------------------------------------------
// A note is [beat, midi, dur]. shift() transposes+offsets a phrase in time.
const shift = (phrase, dBeat, dMidi = 0) =>
  phrase.map(([b, m, d]) => [b + dBeat, m + dMidi, d]);

// Two half-note bass roots per bar from a per-bar root list.
function bassFromRoots(roots, beatsPerBar = 4) {
  const out = [];
  roots.forEach((root, bar) => {
    out.push([bar * beatsPerBar, root, 2], [bar * beatsPerBar + 2, root, 2]);
  });
  return out;
}

// Driving quarter-note bass on every beat (used for Mountain King's pulse).
function pulseBass(rootsPerBar, beatsPerBar = 4) {
  const out = [];
  rootsPerBar.forEach((root, bar) => {
    for (let b = 0; b < beatsPerBar; b++) out.push([bar * beatsPerBar + b, root, 0.9]);
  });
  return out;
}

// === Ode to Joy — Beethoven (Easy) =======================================
// C-major theme (E E F G G F E D C C D E …), the 8-bar tune played twice.
const ODE_THEME = [
  [0, 76, 1], [1, 76, 1], [2, 77, 1], [3, 79, 1],
  [4, 79, 1], [5, 77, 1], [6, 76, 1], [7, 74, 1],
  [8, 72, 1], [9, 72, 1], [10, 74, 1], [11, 76, 1],
  [12, 76, 1.5], [13.5, 74, 0.5], [14, 74, 2],
  [16, 76, 1], [17, 76, 1], [18, 77, 1], [19, 79, 1],
  [20, 79, 1], [21, 77, 1], [22, 76, 1], [23, 74, 1],
  [24, 72, 1], [25, 72, 1], [26, 74, 1], [27, 76, 1],
  [28, 74, 1], [29, 72, 1], [30, 72, 2],
];
const ODE = {
  id: 'ode-to-joy', bpm: 100,
  melody: [...ODE_THEME, ...shift(ODE_THEME, 32)],
  bass: bassFromRoots([48, 43, 48, 43, 48, 43, 48, 48, 48, 43, 48, 43, 48, 43, 48, 48]),
};

// === The Entertainer — Scott Joplin (Medium) =============================
// C-major A-strain, syncopated ragtime. Best-effort hand transcription of the
// main theme (chromatic D–D# pickup, then the bouncing figure + descents).
const ENT_PHRASE = [
  [0, 74, 0.5], [0.5, 75, 0.5], [1, 76, 1], [2, 72, 0.5], [2.5, 76, 0.5], [3, 72, 0.5], [3.5, 76, 0.5],
  [4, 84, 1], [5, 81, 1], [6, 79, 0.5], [6.5, 77, 0.5], [7, 76, 1],
  [8, 74, 0.5], [8.5, 75, 0.5], [9, 76, 1], [10, 72, 0.5], [10.5, 76, 0.5], [11, 72, 0.5], [11.5, 76, 0.5],
  [12, 72, 0.5], [12.5, 74, 0.5], [13, 76, 0.5], [13.5, 77, 0.5], [14, 79, 0.5], [15, 72, 1],
  [16, 79, 0.5], [16.5, 77, 0.5], [17, 76, 0.5], [17.5, 74, 0.5], [18, 72, 1], [19, 76, 1],
  [20, 81, 1], [21, 79, 1], [22, 77, 0.5], [22.5, 76, 0.5], [23, 74, 1],
  [24, 72, 0.5], [24.5, 74, 0.5], [25, 76, 1], [26, 79, 0.5], [26.5, 76, 0.5], [27, 72, 1],
  [28, 74, 0.5], [28.5, 75, 0.5], [29, 76, 1], [30, 72, 2],
];
const ENT_ROOTS = [48, 48, 43, 43, 48, 48, 43, 48];
const ENT = {
  id: 'entertainer', bpm: 110,
  melody: [...ENT_PHRASE, ...shift(ENT_PHRASE, 32)], // play the strain twice
  bass: bassFromRoots([...ENT_ROOTS, ...ENT_ROOTS], 4),
};

// === In the Hall of the Mountain King — Grieg (Hard) =====================
// A-minor creeping theme (A B C D E C E / F E C E), restated and transposed up
// to build, over a relentless quarter-note bass pulse.
const MK_STMT = [
  [0, 57, 0.5], [0.5, 59, 0.5], [1, 60, 0.5], [1.5, 62, 0.5],
  [2, 64, 0.5], [2.5, 60, 0.5], [3, 64, 0.5],
  [4, 65, 0.5], [4.5, 64, 0.5], [5, 60, 0.5], [5.5, 64, 0.5], [6, 64, 1],
];
const MK_OFFSETS = [0, 0, 7, 7, 12, 12, 7, 0]; // statement transpositions (semitones)
const MK_MELODY = [];
const MK_ROOTS = [];
MK_OFFSETS.forEach((off, i) => {
  MK_MELODY.push(...shift(MK_STMT, i * 8, off));
  const root = 45 + (off % 12); // keep bass low
  MK_ROOTS.push(root, root); // each statement spans 2 bars
});
const MK = { id: 'mountain-king', bpm: 138, melody: MK_MELODY, bass: pulseBass(MK_ROOTS) };

const SONGS = [ODE, ENT, MK];

// --- SMF encoding ---------------------------------------------------------

function varLen(n) {
  const bytes = [n & 0x7f];
  n >>= 7;
  while (n > 0) { bytes.unshift((n & 0x7f) | 0x80); n >>= 7; }
  return bytes;
}

function notesToTrackBytes(notes, channel, ppq) {
  const evs = [];
  for (const [beat, midi, dur] of notes) {
    const onTick = Math.round(beat * ppq);
    const offTick = Math.round((beat + dur) * ppq);
    const strong = Number.isInteger(beat);
    evs.push({ tick: onTick, data: [0x90 | channel, midi, channel ? 78 : (strong ? 102 : 84)] });
    evs.push({ tick: offTick, data: [0x80 | channel, midi, 0] });
  }
  evs.sort((a, b) => a.tick - b.tick || (a.data[0] & 0xf0) - (b.data[0] & 0xf0));
  const out = [];
  let prev = 0;
  for (const e of evs) { out.push(...varLen(e.tick - prev), ...e.data); prev = e.tick; }
  out.push(...varLen(0), 0xff, 0x2f, 0x00); // end of track
  return out;
}

function tempoTrackBytes(bpm) {
  const us = Math.round(60000000 / bpm);
  return [
    ...varLen(0), 0xff, 0x51, 0x03, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff,
    ...varLen(0), 0xff, 0x2f, 0x00,
  ];
}

function chunk(id, bytes) {
  const head = [...id].map((c) => c.charCodeAt(0));
  const len = bytes.length;
  return [...head, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff, ...bytes];
}

function buildMidi(song) {
  const header = chunk('MThd', [0, 1, 0, 3, (PPQ >> 8) & 0xff, PPQ & 0xff]); // format 1, 3 tracks
  const t0 = chunk('MTrk', tempoTrackBytes(song.bpm));
  const t1 = chunk('MTrk', notesToTrackBytes(song.melody, 0, PPQ));
  const t2 = chunk('MTrk', notesToTrackBytes(song.bass, 1, PPQ));
  return Uint8Array.from([...header, ...t0, ...t1, ...t2]);
}

mkdirSync(OUT, { recursive: true });
for (const song of SONGS) {
  const bytes = buildMidi(song);
  writeFileSync(join(OUT, `${song.id}.mid`), bytes);
  console.log(`wrote ${song.id}.mid (${bytes.length} bytes, ${song.melody.length} melody notes)`);
}
