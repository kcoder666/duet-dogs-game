// Web Audio engine. Generates all sound live (no audio files):
//  - a looping backing track (kick / hat / snare / bass) per song
//  - a pentatonic "pluck" played when a treat is caught. The left lane uses a
//    lower octave and the right lane a higher one, so catches form a duet.
//  - UI / miss sound effects.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.running = false;
    this._timer = null;
    this._nextBeat = 0; // index of next beat to schedule
    this._nextTime = 0; // audio time of that beat
    this.song = null;
  }

  async resume() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.55;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // Start a song: procedural drum groove + the parsed MIDI melody/bass notes.
  // midiNotes are pre-shifted (note.time = game-time of the note). Returns the
  // audio time the track began — the timing origin shared with the beatmap.
  startMusic(song, midiNotes = [], duration = 30, startDelay = 0.2) {
    this.song = song;
    this.running = true;
    this._nextBeat = 0;
    const start = this.now() + startDelay;
    this._nextTime = start;
    this.musicEnd = start + duration;
    // Only the bass auto-plays as backing — the melody (channel 0) is performed
    // by the player: each caught treat triggers its real melody note.
    this.events = midiNotes
      .filter((n) => n.chan === 1)
      .map((n) => ({ at: start + n.time, kind: 'bass', midi: n.midi, dur: n.dur, vel: n.vel || 90 }))
      .sort((a, b) => a.at - b.at);
    this._evIdx = 0;
    this._scheduler();
    return start;
  }

  stopMusic() {
    this.running = false;
    clearTimeout(this._timer);
  }

  setMuted(muted) {
    if (this.master) this.master.gain.value = muted ? 0 : 0.9;
  }

  // Lookahead scheduler: queue drum grid + MIDI events due in the next 0.12s.
  _scheduler() {
    if (!this.running) return;
    const horizon = this.now() + 0.12;
    const spb = 60 / this.song.bpm;
    while (this._nextTime < horizon && this._nextTime < this.musicEnd) {
      this._scheduleBeat(this._nextBeat, this._nextTime);
      this._nextBeat++;
      this._nextTime += spb / 2; // eighth-note grid
    }
    while (this._evIdx < this.events.length && this.events[this._evIdx].at < horizon) {
      const e = this.events[this._evIdx++];
      this._bass(e.at, e.midi); // events contain only the backing bass line
    }
    this._timer = setTimeout(() => this._scheduler(), 25);
  }

  // Drums only — bass comes from MIDI events, melody is performed on catch.
  _scheduleBeat(i, t) {
    const eighth = i % 8;
    if (eighth % 2 === 0) this._kick(t, eighth === 0 ? 1 : 0.7);
    this._hat(t, eighth % 2 ? 0.5 : 0.3);
    if (eighth === 4) this._snare(t);
  }

  _env(node, t, a, d, peak = 1) {
    const g = node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + a);
    g.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  _kick(t, vol = 1) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    this._env(g, t, 0.005, 0.18, 0.9 * vol);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.25);
  }

  _hat(t, vol = 0.4) {
    const buf = this._noise();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = this.ctx.createGain();
    this._env(g, t, 0.002, 0.04, vol * 0.4);
    src.connect(hp).connect(g).connect(this.musicGain);
    src.start(t);
    src.stop(t + 0.06);
  }

  _snare(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    const g = this.ctx.createGain();
    this._env(g, t, 0.003, 0.14, 0.5);
    src.connect(bp).connect(g).connect(this.musicGain);
    src.start(t);
    src.stop(t + 0.2);
  }

  _bass(t, midi) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midiToFreq(midi);
    const g = this.ctx.createGain();
    this._env(g, t, 0.01, 0.22, 0.35);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.3);
  }

  _noise() {
    if (this._noiseBuf) return this._noiseBuf;
    const n = 0.2 * this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
    return buf;
  }

  // Pentatonic catch note. lane 0 = left (low), 1 = right (high).
  // step climbs with combo for a rising, rewarding feel.
  playCatch(lane, step = 0) {
    if (!this.ctx) return;
    const penta = [0, 2, 4, 7, 9, 12];
    const base = 60 + (lane === 1 ? 12 : 0); // left pup lower, right pup higher
    const midi = base + penta[step % penta.length] + Math.floor(step / penta.length) * 12;
    const t = this.now();
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midiToFreq(midi);
    const o2 = this.ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = midiToFreq(midi + 12);
    const g = this.ctx.createGain();
    this._env(g, t, 0.005, 0.32, 0.5);
    o.connect(g);
    o2.connect(g);
    g.connect(this.master);
    o.start(t); o2.start(t);
    o.stop(t + 0.4); o2.stop(t + 0.4);
  }

  // Play an exact melody note (the song's note for a treat). A perfect hit
  // rings brightest; `volume` (0..1) dims it — missed notes still sound, softly,
  // so the player can keep hearing and recognising the song.
  playMelodyNote(midi, perfect = true, volume = 1) {
    if (!this.ctx || !Number.isFinite(midi)) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midiToFreq(midi);
    const o2 = this.ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = midiToFreq(midi + 12);
    const g = this.ctx.createGain();
    this._env(g, t, 0.005, perfect ? 0.42 : 0.3, (perfect ? 0.55 : 0.42) * volume);
    o.connect(g); o2.connect(g); g.connect(this.master);
    o.start(t); o2.start(t);
    o.stop(t + 0.5); o2.stop(t + 0.5);
  }

  // A short synthesized bark layered on a catch. `voice` (0 deep … 1 high) comes
  // from the character, so each breed barks differently — big dogs woof low,
  // the poodle yips high. A tonal pitch-drop body + a noise "chuff" for bite.
  playBark(voice = 0.5) {
    if (!this.ctx) return;
    const t = this.now();
    const f0 = 250 + voice * 380; // start pitch
    const f1 = f0 * 0.55;         // quick downward drop = the "wuf"
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.11);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700 + voice * 1400;
    bp.Q.value = 1.1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(bp).connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.2);
    // noise transient for the bark's bite
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1300 + voice * 1600;
    hp.Q.value = 0.8;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.13, t + 0.008);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(hp).connect(ng).connect(this.master);
    src.start(t); src.stop(t + 0.12);
  }

  playMiss() {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.18);
    const g = this.ctx.createGain();
    // Kept subtle so the softly-played missed melody note stays recognisable.
    this._env(g, t, 0.005, 0.16, 0.12);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.25);
  }

  playUi(up = true) {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = up ? 660 : 440;
    const g = this.ctx.createGain();
    this._env(g, t, 0.005, 0.12, 0.18);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.16);
  }
}

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}
