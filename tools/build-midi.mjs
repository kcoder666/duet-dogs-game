// Dev script: composes ORIGINAL pop-style tunes and writes real .mid files to
// assets/music/. Run once with `node tools/build-midi.mjs`; commit the output.
// Melodies are generated algorithmically over common pop chord progressions —
// 100% original, no copyrighted material reproduced.
//
//   channel 0 = melody  (becomes the catchable treats)
//   channel 1 = bass    (accompaniment only)

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PPQ = 480;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'music');

// Major-scale semitone offsets, and a pentatonic subset for hooky melodies.
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const PENTA = [0, 2, 4, 7, 9];

// Each song: a I–V–vi–IV-style progression (degrees into the scale, 0-based),
// a tonic midi root, bpm, bar count and a melody "busyness" per eighth slot.
const SONGS = [
  { id: 'puppy-park', root: 60, bpm: 96, bars: 16, prog: [0, 4, 5, 3], density: 0.55, seed: 7 },
  { id: 'treat-street', root: 62, bpm: 116, bars: 16, prog: [5, 3, 0, 4], density: 0.72, seed: 21 },
  { id: 'midnight-zoomies', root: 64, bpm: 140, bars: 16, prog: [0, 5, 3, 4], density: 0.88, seed: 99 },
];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scaleNote(root, degree) {
  const oct = Math.floor(degree / SCALE.length);
  return root + SCALE[((degree % SCALE.length) + SCALE.length) % SCALE.length] + oct * 12;
}

function compose(song) {
  const rng = mulberry32(song.seed);
  const melody = []; // {beat, dur, midi, vel}
  const bass = [];
  let lastDeg = 7; // start an octave up for a bright lead
  for (let bar = 0; bar < song.bars; bar++) {
    const chordRoot = song.prog[bar % song.prog.length]; // scale degree of the chord
    // Bass: root on beat 1, fifth on beat 3.
    bass.push({ beat: bar * 4, dur: 2, midi: scaleNote(song.root - 12, chordRoot), vel: 80 });
    bass.push({ beat: bar * 4 + 2, dur: 2, midi: scaleNote(song.root - 12, chordRoot + 4), vel: 70 });
    // Melody: walk the pentatonic on an eighth grid, snapping to chord tones on strong beats.
    for (let e = 0; e < 8; e++) {
      const strong = e % 2 === 0;
      if (!strong && rng() > song.density) continue;
      if (strong && rng() > Math.min(1, song.density + 0.25)) continue;
      let deg;
      if (strong) {
        // chord tone: chord root, third or fifth (in scale steps ~ 0,2,4)
        deg = chordRoot + [0, 2, 4][Math.floor(rng() * 3)] + 7;
      } else {
        // passing tone near the last note, kept in pentatonic feel
        const step = PENTA[Math.floor(rng() * PENTA.length)] - PENTA[Math.floor(rng() * PENTA.length)];
        deg = lastDeg + (rng() < 0.5 ? 1 : -1) * (Math.abs(step) > 0 ? 1 : 1);
      }
      deg = Math.max(5, Math.min(16, deg));
      lastDeg = deg;
      melody.push({
        beat: bar * 4 + e * 0.5,
        dur: 0.45,
        midi: scaleNote(song.root, deg),
        vel: strong ? 100 : 82,
      });
    }
  }
  return { melody, bass };
}

// --- SMF encoding ---------------------------------------------------------

function varLen(n) {
  const bytes = [n & 0x7f];
  n >>= 7;
  while (n > 0) { bytes.unshift((n & 0x7f) | 0x80); n >>= 7; }
  return bytes;
}

function notesToTrackBytes(notes, channel, ppq) {
  // Build (tick, [bytes]) events for note on/off, then delta-encode.
  const evs = [];
  for (const n of notes) {
    const onTick = Math.round(n.beat * ppq);
    const offTick = Math.round((n.beat + n.dur) * ppq);
    evs.push({ tick: onTick, data: [0x90 | channel, n.midi, n.vel] });
    evs.push({ tick: offTick, data: [0x80 | channel, n.midi, 0] });
  }
  evs.sort((a, b) => a.tick - b.tick || (a.data[0] & 0xf0) - (b.data[0] & 0xf0));
  const out = [];
  let prev = 0;
  for (const e of evs) {
    out.push(...varLen(e.tick - prev), ...e.data);
    prev = e.tick;
  }
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
  const { melody, bass } = compose(song);
  const header = chunk('MThd', [0, 1, 0, 3, (PPQ >> 8) & 0xff, PPQ & 0xff]); // format 1, 3 tracks
  const t0 = chunk('MTrk', tempoTrackBytes(song.bpm));
  const t1 = chunk('MTrk', notesToTrackBytes(melody, 0, PPQ));
  const t2 = chunk('MTrk', notesToTrackBytes(bass, 1, PPQ));
  return Uint8Array.from([...header, ...t0, ...t1, ...t2]);
}

mkdirSync(OUT, { recursive: true });
for (const song of SONGS) {
  const bytes = buildMidi(song);
  writeFileSync(join(OUT, `${song.id}.mid`), bytes);
  console.log(`wrote ${song.id}.mid (${bytes.length} bytes)`);
}
