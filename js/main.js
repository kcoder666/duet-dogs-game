// Bootstrap: wires audio, game, UI and input together, and keeps the canvas
// backing store crisp on high-DPI screens.

import { AudioEngine } from './audio.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { attachInput } from './input.js';
import { getSong } from './beatmap.js';
import { getCharacter, PACK } from './characters.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const audio = new AudioEngine();
const game = new Game(canvas, audio);
const ui = new UI(document.getElementById('ui'));

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', fitCanvas);

let current = { song: null, left: null, right: null };

attachInput(canvas, (lane) => game.tap(lane));

const hud = document.getElementById('hud');
const pauseOverlay = document.getElementById('pause');
const btnPauseIcon = document.getElementById('btn-pause');

const showHud = (on) => { hud.classList.toggle('hidden', !on); hud.setAttribute('aria-hidden', !on); };
const showPause = (on) => {
  pauseOverlay.classList.toggle('hidden', !on);
  pauseOverlay.setAttribute('aria-hidden', !on);
  btnPauseIcon.textContent = on ? '▶' : '⏸';
};

document.getElementById('btn-pause').onclick = () => {
  game.togglePause();
  showPause(game.paused);
};
document.getElementById('btn-restart').onclick = () => game.restart();
document.getElementById('btn-resume').onclick = () => { game.resume(); showPause(false); };
document.getElementById('btn-restart-pause').onclick = () => { showPause(false); game.restart(); };
document.getElementById('btn-quit').onclick = () => {
  game.stop();
  showPause(false); showHud(false);
  ui.showTitle();
};

// Escape toggles pause while playing.
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && game.running) {
    e.preventDefault();
    game.togglePause();
    showPause(game.paused);
  }
});

game.onEnd = (result) => {
  showHud(false); showPause(false);
  ui.showResults(result);
};

ui.handlers = {
  onToggleMute: () => {
    ui.muted = !ui.muted;
    audio.setMuted(ui.muted);
    ui.showTitle();
  },
  onPlay: async () => {
    await audio.resume();
    audio.preloadBarks(PACK.map((c) => c.id)); // load any generated bark SFX
    audio.playUi(true);
    ui.showSongs();
  },
  onSong: (id) => {
    audio.playUi(true);
    ui.showChars(getSong(id));
  },
  onPreview: (char) => audio.playBark(char),
  onStart: async (song, leftId, rightId) => {
    await audio.resume();
    audio.preloadBarks(PACK.map((c) => c.id)); // idempotent — safety-net preload
    current = { song, left: getCharacter(leftId), right: getCharacter(rightId) };
    ui.hide();
    fitCanvas();
    showHud(true); showPause(false);
    game.start(song, current.left, current.right);
  },
  onRetry: async () => {
    await audio.resume();
    audio.preloadBarks(PACK.map((c) => c.id));
    ui.hide();
    fitCanvas();
    showHud(true); showPause(false);
    game.start(current.song, current.left, current.right);
  },
  onMenu: () => {
    audio.playUi(false);
    ui.showTitle();
  },
};

fitCanvas();
ui.showTitle();

// Debug/automation handle (also a convenient seam for a future native bridge).
window.duetDogs = { game, audio, ui };
