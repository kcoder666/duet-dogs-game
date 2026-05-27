// Core game: owns the run state, judges taps against the beatmap, advances
// timers/particles each frame. Rendering and audio are injected so this stays
// portable. Drives the play loop until the song ends or happiness hits zero.

import {
  SCORE, HAPPINESS, DOG_SLIDE_SPEED, SETTLE_PERFECT, comboMultiplier, rankFor,
} from './config.js';
import { BRAND } from './config.js';
import { buildBeatmapFromMidi } from './beatmap.js';
import { parseMidi } from './midi.js';
import { draw } from './renderer.js';

export class Game {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.running = false;
    this.onEnd = null;
  }

  async start(song, leftChar, rightChar) {
    this.song = song;
    this.leftChar = leftChar;
    this.rightChar = rightChar;
    // Load + parse the song's MIDI; shift notes by an intro offset (count-in +
    // fall lead) so the first treat has room to fall. On any failure the
    // beatmap builder produces a procedural fallback chart.
    let shifted = [];
    try {
      const buf = await fetch(song.file).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      });
      const midi = parseMidi(buf);
      const offset = song.fallTime + 60 / song.bpm;
      shifted = midi.notes.map((n) => ({ ...n, time: n.time + offset }));
    } catch (e) {
      console.warn('MIDI load failed, using fallback chart:', e.message);
      shifted = [];
    }
    const map = buildBeatmapFromMidi(shifted, song);
    this.shiftedNotes = shifted;
    this.fallTime = map.fallTime;
    this.duration = map.duration;
    this.treats = map.notes.map((n) => ({ ...n, judged: false }));
    this.totalGood = this.treats.filter((t) => t.type === 'good').length;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.happiness = HAPPINESS.start;
    this.hits = 0;
    this.perfects = 0;
    this.goods = 0;
    this.misses = 0;
    this.popups = [];
    this.particles = [];
    this.shake = 0;
    this.comboPulse = 0;
    this.hitFlash = [0, 0];
    this.tapFlash = [0, 0];
    this.dogsState = {
      0: { mouthOpen: 0, blink: 0, bob: 0, blinkT: Math.random() * 3 },
      1: { mouthOpen: 0, blink: 0, bob: 0, blinkT: Math.random() * 3 },
    };
    // Each dog slides between its two slots. dogPos is the animated fractional
    // position (0..1); dogTarget is the slot (0 or 1) the player steered it to.
    this.dogPos = [0, 0];
    this.dogTarget = [0, 0];
    this.musicStart = this.audio.startMusic(song, shifted, map.duration);
    this.running = true;
    this.lastFrame = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    this.audio.stopMusic();
  }

  get audioTime() {
    return this.audio.now() - this.musicStart;
  }

  // Player tapped a column (0..3): steer that side's dog to the matching slot.
  // Catching is resolved when a treat reaches the dog, not on the tap itself.
  tap(column) {
    if (!this.running) return;
    const side = column < 2 ? 0 : 1;
    const slot = column % 2;
    this.dogTarget[side] = slot;
    this._triggerDog(side);
  }

  // A treat reached the hit line: did the owning dog get there in time?
  _resolve(treat) {
    treat.judged = true;
    const side = treat.side;
    const onSlot = this.dogTarget[side] === treat.slot;
    const settled = Math.abs(this.dogPos[side] - treat.slot) <= SETTLE_PERFECT;
    if (treat.type === 'decoy') {
      if (onSlot && settled) this._registerDecoyHit(treat); // dog sitting on it
      return;
    }
    if (onSlot) this._registerCatch(treat, settled);
    else this._registerMiss(treat);
  }

  _registerCatch(treat, perfect) {
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.hits++;
    if (perfect) this.perfects++; else this.goods++;
    const base = perfect ? SCORE.perfect : SCORE.good;
    this.score += Math.round(base * comboMultiplier(this.combo));
    this.happiness = Math.min(HAPPINESS.max,
      this.happiness + (perfect ? HAPPINESS.perfectGain : HAPPINESS.goodGain));
    // Catching performs the song: play this treat's actual melody note.
    // (Fallback charts without a source note use the pentatonic catch sound.)
    if (Number.isFinite(treat.midi)) this.audio.playMelodyNote(treat.midi, perfect);
    else this.audio.playCatch(treat.side, Math.floor(this.combo / 2));
    this.comboPulse = 1;
    this.hitFlash[treat.side] = 1;
    const L = this._layout();
    const x = L.colCx[treat.side * 2 + treat.slot];
    this._popup(x, L.hitY - L.dogR * 1.4,
      perfect ? 'PERFECT!' : 'GOOD', perfect ? BRAND.gold : BRAND.green,
      perfect ? 24 : 20);
    this._burst(x, L.hitY, perfect ? 14 : 8, treat.emoji);
    vibrate(perfect ? 18 : 10);
  }

  _registerDecoyHit(treat) {
    this.combo = 0;
    this.misses++;
    this.happiness -= HAPPINESS.decoyLoss;
    this.audio.playMiss();
    this.shake = 14;
    const L = this._layout();
    this._popup(L.colCx[treat.side * 2 + treat.slot], L.hitY - L.dogR * 1.4, 'OOPS! 🌶️', '#E0563B', 22);
    if (this.happiness <= 0) this._end();
  }

  _registerMiss(treat) {
    this.combo = 0;
    this.misses++;
    this.happiness -= HAPPINESS.missLoss;
    this.shake = 8;
    this.audio.playMiss();
    // Still sound the missed note quietly so the melody stays recognisable.
    if (Number.isFinite(treat.midi)) this.audio.playMelodyNote(treat.midi, false, 0.4);
    const L = this._layout();
    this._popup(L.colCx[treat.side * 2 + treat.slot], L.hitY - L.dogR, 'MISS', '#E0563B', 18);
    if (this.happiness <= 0) this._end();
  }

  _loop(ts) {
    if (!this.running) return;
    const dt = Math.min(0.05, (ts - this.lastFrame) / 1000);
    this.lastFrame = ts;
    this._update(dt);
    draw(this.ctx, this.canvas.clientWidth, this.canvas.clientHeight, this._snapshot());
    requestAnimationFrame(this._loop);
  }

  _update(dt) {
    const now = this.audioTime;
    // Slide each dog toward its target slot.
    for (const side of [0, 1]) {
      const step = DOG_SLIDE_SPEED * dt;
      const diff = this.dogTarget[side] - this.dogPos[side];
      this.dogPos[side] += Math.max(-step, Math.min(step, diff));
    }
    // Resolve treats as they reach the hit line (catch if the dog is there).
    for (const t of this.treats) {
      if (!t.judged && now >= t.time) this._resolve(t);
    }
    // decay transient visuals
    this.shake = Math.max(0, this.shake - dt * 60);
    this.comboPulse = Math.max(0, this.comboPulse - dt * 3);
    for (const lane of [0, 1]) {
      this.hitFlash[lane] = Math.max(0, this.hitFlash[lane] - dt * 4);
      this.tapFlash[lane] = Math.max(0, this.tapFlash[lane] - dt * 5);
      const d = this.dogsState[lane];
      d.mouthOpen = Math.max(0, d.mouthOpen - dt * 5);
      d.bob = d.bob * 0.85;
      d.blinkT -= dt;
      d.blink = d.blink > 0 ? Math.max(0, d.blink - dt * 8) : d.blink;
      if (d.blinkT <= 0) { d.blink = 1; d.blinkT = 2 + Math.random() * 3; }
    }
    this._stepParticles(dt);
    this._stepPopups(dt);
    if (now > this.duration) this._end();
  }

  _stepParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 400 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  _stepPopups(dt) {
    for (const p of this.popups) p.life -= dt;
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  _triggerDog(lane) {
    const d = this.dogsState[lane];
    d.mouthOpen = 1;
    d.bob = -8;
    this.tapFlash[lane] = 1;
  }

  _popup(x, y, text, color, size) {
    this.popups.push({ x, y, text, color, size, life: 0.8, maxLife: 0.8 });
  }

  _burst(x, y, n, emoji) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        life: 0.6 + Math.random() * 0.3,
        maxLife: 0.9,
        size: i % 3 === 0 ? 22 : 5 + Math.random() * 4,
        emoji: i % 3 === 0 ? emoji : null,
        color: ['#B8862E', '#F4A6B8', '#7CB85F'][i % 3],
      });
    }
  }

  _layout() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const colCx = [0, 1, 2, 3].map((i) => (i + 0.5) * w / 4);
    return { colCx, hitY: h * 0.8, dogR: Math.min(w * 0.11, 54) };
  }

  _end() {
    if (!this.running) return;
    this.running = false;
    this.audio.stopMusic();
    const totalJudged = this.hits + this.misses;
    const accuracy = this.totalGood ? this.hits / this.totalGood : 0;
    const result = {
      song: this.song,
      score: this.score,
      maxCombo: this.maxCombo,
      perfects: this.perfects,
      goods: this.goods,
      misses: this.misses,
      accuracy,
      rank: rankFor(accuracy),
      survived: this.happiness > 0,
      leftChar: this.leftChar,
      rightChar: this.rightChar,
    };
    if (this.onEnd) this.onEnd(result);
  }

  _snapshot() {
    return {
      treats: this.treats,
      dogsState: this.dogsState,
      dogPos: this.dogPos,
      dogTarget: this.dogTarget,
      leftChar: this.leftChar,
      rightChar: this.rightChar,
      score: this.score,
      combo: this.combo,
      happiness: this.happiness,
      popups: this.popups,
      particles: this.particles,
      shake: this.shake,
      comboPulse: this.comboPulse,
      hitFlash: this.hitFlash,
      tapFlash: this.tapFlash,
      audioTime: this.audioTime,
      fallTime: this.fallTime,
      bps: this.song.bpm / 60,
    };
  }
}

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}
