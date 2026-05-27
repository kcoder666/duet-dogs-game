// DOM screen flow: title → song select → pick the duet → results.
// Renders dog previews to small canvases via the shared drawDog routine.
// main.js wires handlers; this module only builds markup and emits intents.

import { SONGS } from './beatmap.js';
import { PACK, drawDog } from './characters.js';

export class UI {
  constructor(root) {
    this.root = root;
    this.handlers = {};
    this.selectedSong = SONGS[0];
    this.leftId = 'max';
    this.rightId = 'rocky';
    this.muted = false;
  }

  _screen(html) {
    this.root.innerHTML = html;
    this.root.classList.add('active');
  }

  hide() {
    this.root.classList.remove('active');
    this.root.innerHTML = '';
  }

  showTitle() {
    this._screen(`
      <div class="screen title">
        <div class="logo">
          <div class="logo-dogs"><canvas id="t-left" width="120" height="120"></canvas>
          <canvas id="t-right" width="120" height="120"></canvas></div>
          <h1>Duet&nbsp;Dogs</h1>
          <p class="tag">A ScoutPaw rhythm game · catch the treats on the beat</p>
        </div>
        <button class="btn primary" id="play">▶ Play</button>
        <button class="btn ghost" id="mute">${this.muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
        <p class="hint">Each pup slides between two spots — tap under a falling treat (or use keys <b>A&nbsp;S</b> for the left pup, <b>←&nbsp;→</b> for the right) to catch it on the beat. Keep both pups happy!</p>
      </div>`);
    renderPreview(document.getElementById('t-left'), 'max', 'idle');
    renderPreview(document.getElementById('t-right'), 'bella', 'idle');
    document.getElementById('play').onclick = () => this.handlers.onPlay?.();
    document.getElementById('mute').onclick = () => this.handlers.onToggleMute?.();
  }

  showSongs() {
    const cards = SONGS.map((s) => `
      <button class="song-card" data-song="${s.id}">
        <span class="song-emoji">${s.theme}</span>
        <span class="song-meta"><b>${s.title}</b><small>${s.subtitle}</small></span>
        <span class="diff diff-${s.difficulty.toLowerCase()}">${s.difficulty}</span>
      </button>`).join('');
    this._screen(`
      <div class="screen">
        <h2>Pick a track</h2>
        <div class="song-list">${cards}</div>
        <button class="btn ghost" id="back">← Back</button>
      </div>`);
    this.root.querySelectorAll('.song-card').forEach((el) => {
      el.onclick = () => this.handlers.onSong?.(el.dataset.song);
    });
    document.getElementById('back').onclick = () => this.showTitle();
  }

  showChars(song) {
    this.selectedSong = song;
    const grid = PACK.map((c) => `
      <button class="dog-card" data-id="${c.id}">
        <canvas width="110" height="110" data-prev="${c.id}"></canvas>
        <b>${c.name}</b><small>${c.breed}</small>
      </button>`).join('');
    this._screen(`
      <div class="screen">
        <h2>Choose your duet</h2>
        <p class="tag">Left pup &amp; right pup — they’ll sing together 🎵</p>
        <div class="slots">
          <div class="slot" id="slot-left"><span>LEFT</span></div>
          <div class="slot" id="slot-right"><span>RIGHT</span></div>
        </div>
        <div class="dog-grid">${grid}</div>
        <div class="row">
          <button class="btn ghost" id="back">← Back</button>
          <button class="btn primary" id="start">Start 🎶</button>
        </div>
      </div>`);
    this.root.querySelectorAll('canvas[data-prev]').forEach((cv) =>
      renderPreview(cv, cv.dataset.prev, 'idle'));
    this._activeSlot = 'left';
    this.root.querySelectorAll('.dog-card').forEach((el) => {
      el.onclick = () => this._assign(el.dataset.id);
    });
    document.getElementById('slot-left').onclick = () => { this._activeSlot = 'left'; this._refreshSlots(); };
    document.getElementById('slot-right').onclick = () => { this._activeSlot = 'right'; this._refreshSlots(); };
    document.getElementById('back').onclick = () => this.showSongs();
    document.getElementById('start').onclick = () =>
      this.handlers.onStart?.(this.selectedSong, this.leftId, this.rightId);
    this._refreshSlots();
  }

  _assign(id) {
    const char = PACK.find((p) => p.id === id);
    if (char) this.handlers.onPreview?.(char); // preview that pup's bark
    if (this._activeSlot === 'left') { this.leftId = id; this._activeSlot = 'right'; }
    else { this.rightId = id; this._activeSlot = 'left'; }
    this._refreshSlots();
  }

  _refreshSlots() {
    const left = document.getElementById('slot-left');
    const right = document.getElementById('slot-right');
    if (!left) return;
    left.classList.toggle('on', this._activeSlot === 'left');
    right.classList.toggle('on', this._activeSlot === 'right');
    fillSlot(left, this.leftId, 'LEFT');
    fillSlot(right, this.rightId, 'RIGHT');
  }

  showResults(r) {
    const pct = Math.round(r.accuracy * 100);
    const line = r.survived ? 'Pawsome performance!' : 'The pups got grumpy 😢';
    this._screen(`
      <div class="screen results">
        <h2>${line}</h2>
        <div class="rank rank-${r.rank}">${r.rank}</div>
        <div class="dogs-celebrate"><canvas id="r-left" width="110" height="110"></canvas>
        <canvas id="r-right" width="110" height="110"></canvas></div>
        <div class="stats">
          <div><b>${r.score.toLocaleString()}</b><small>Score</small></div>
          <div><b>${r.maxCombo}x</b><small>Max combo</small></div>
          <div><b>${pct}%</b><small>Accuracy</small></div>
        </div>
        <div class="stats sub">
          <div><b>${r.perfects}</b><small>Perfect</small></div>
          <div><b>${r.goods}</b><small>Good</small></div>
          <div><b>${r.misses}</b><small>Miss</small></div>
        </div>
        <div class="row">
          <button class="btn ghost" id="menu">Menu</button>
          <button class="btn primary" id="retry">Retry</button>
        </div>
      </div>`);
    renderPreview(document.getElementById('r-left'), r.leftChar.id, 'happy');
    renderPreview(document.getElementById('r-right'), r.rightChar.id, 'happy');
    document.getElementById('retry').onclick = () => this.handlers.onRetry?.();
    document.getElementById('menu').onclick = () => this.handlers.onMenu?.();
  }
}

function fillSlot(el, id, label) {
  const c = PACK.find((p) => p.id === id);
  el.innerHTML = `<canvas width="80" height="80"></canvas><span>${c.name}<br><small>${label}</small></span>`;
  renderPreview(el.querySelector('canvas'), id, 'idle');
}

function renderPreview(canvas, id, mood) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const c = PACK.find((p) => p.id === id) || PACK[0];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawDog(ctx, canvas.width / 2, canvas.height * 0.55, canvas.width * 0.33, c, {
    mouthOpen: mood === 'happy' ? 0.8 : 0,
    blink: 0,
  });
}
