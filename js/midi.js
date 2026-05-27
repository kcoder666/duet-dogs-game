// Minimal Standard MIDI File (SMF) parser. Turns a .mid ArrayBuffer into a flat
// list of timed notes (seconds) so the game can both play the song and build a
// beatmap from its actual notes. Supports format 0/1, running status, tempo
// meta events and multi-track tempo maps. Not a full spec implementation —
// just what these game tracks need.

export function parseMidi(arrayBuffer) {
  const v = new DataView(arrayBuffer);
  let p = 0;
  const u32 = () => { const x = v.getUint32(p); p += 4; return x; };
  const u16 = () => { const x = v.getUint16(p); p += 2; return x; };
  const u8 = () => v.getUint8(p++);

  if (u32() !== 0x4d546864) throw new Error('Not a MIDI file (missing MThd)');
  u32(); // header length (always 6)
  u16(); // format
  const nTracks = u16();
  const division = u16(); // ticks per quarter (assume not SMPTE)

  const rawTracks = [];
  const tempoChanges = [{ tick: 0, usPerQuarter: 500000 }]; // default 120 BPM

  for (let t = 0; t < nTracks; t++) {
    if (u32() !== 0x4d54726b) throw new Error('Expected MTrk');
    const len = u32();
    const end = p + len;
    let tick = 0;
    let status = 0;
    const events = [];
    while (p < end) {
      tick += readVarLen();
      let byte = v.getUint8(p);
      if (byte & 0x80) { status = byte; p++; } // new status, else running status
      const type = status & 0xf0;
      if (status === 0xff) {
        const metaType = u8();
        const mlen = readVarLen();
        if (metaType === 0x51) {
          const us = (u8() << 16) | (u8() << 8) | u8();
          tempoChanges.push({ tick, usPerQuarter: us });
        } else { p += mlen; }
      } else if (status === 0xf0 || status === 0xf7) {
        p += readVarLen();
      } else if (type === 0x90 || type === 0x80) {
        const note = u8();
        const vel = u8();
        events.push({ tick, on: type === 0x90 && vel > 0, note, vel, chan: status & 0x0f });
      } else if (type === 0xc0 || type === 0xd0) {
        p += 1; // program change / channel pressure: 1 data byte
      } else {
        p += 2; // other channel voice messages: 2 data bytes
      }
    }
    p = end;
    rawTracks.push(events);
  }

  tempoChanges.sort((a, b) => a.tick - b.tick);
  const tickToSec = makeTickToSec(tempoChanges, division);

  const notes = [];
  rawTracks.forEach((events, trackIndex) => {
    const open = new Map(); // note|chan -> startTick
    for (const e of events) {
      const key = e.note * 16 + e.chan;
      if (e.on) {
        open.set(key, e.tick);
      } else if (open.has(key)) {
        const startTick = open.get(key);
        open.delete(key);
        const time = tickToSec(startTick);
        notes.push({
          time,
          dur: tickToSec(e.tick) - time,
          midi: e.note,
          chan: e.chan,
          track: trackIndex,
        });
      }
    }
  });
  notes.sort((a, b) => a.time - b.time);
  return { division, notes, duration: notes.length ? notes[notes.length - 1].time + 1 : 0 };

  function readVarLen() {
    let value = 0;
    let b;
    do { b = v.getUint8(p++); value = (value << 7) | (b & 0x7f); } while (b & 0x80);
    return value;
  }
}

function makeTickToSec(tempoChanges, division) {
  // Precompute cumulative seconds at each tempo boundary.
  const pts = tempoChanges.map((c) => ({ ...c }));
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) { pts[i].sec = 0; continue; }
    const prev = pts[i - 1];
    const dTicks = pts[i].tick - prev.tick;
    pts[i].sec = prev.sec + (dTicks * prev.usPerQuarter) / division / 1e6;
  }
  return (tick) => {
    let i = pts.length - 1;
    while (i > 0 && pts[i].tick > tick) i--;
    const base = pts[i];
    return base.sec + ((tick - base.tick) * base.usPerQuarter) / division / 1e6;
  };
}
