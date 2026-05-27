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

game.onEnd = (result) => {
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
    current = { song, left: getCharacter(leftId), right: getCharacter(rightId) };
    ui.hide();
    fitCanvas();
    game.start(song, current.left, current.right);
  },
  onRetry: async () => {
    await audio.resume();
    ui.hide();
    fitCanvas();
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
