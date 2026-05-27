// Canvas renderer. Pure drawing — reads game state, draws a frame. All sizes
// derive from the current canvas CSS pixel size so it scales to any phone.

import { BRAND } from './config.js';
import { drawDog } from './characters.js';

// Color-emoji font stack — plain "serif" renders dull/blurry monochrome glyphs.
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export function computeLayout(w, h) {
  const hitY = h * 0.8;
  const topY = -h * 0.06;
  // 4 columns: cols 0,1 belong to the left dog; cols 2,3 to the right dog.
  const colCx = [0, 1, 2, 3].map((i) => (i + 0.5) * w / 4);
  return {
    w, h, hitY, topY, colCx,
    dogR: Math.min(w * 0.11, 54),
    treatR: Math.min(w * 0.06, 28),
  };
}

export function draw(ctx, w, h, s) {
  const L = computeLayout(w, h);
  ctx.save();
  if (s.shake > 0) {
    ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
  }
  drawBackground(ctx, L, s);
  drawLanes(ctx, L);
  drawPads(ctx, L, s);
  drawTreats(ctx, L, s);
  drawDogs(ctx, L, s);
  drawParticles(ctx, s);
  drawPopups(ctx, s);
  ctx.restore();
  drawHud(ctx, L, s); // HUD ignores shake
}

function drawBackground(ctx, L, s) {
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, BRAND.cream);
  g.addColorStop(1, BRAND.creamDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L.w, L.h);
  // drifting paw prints
  ctx.fillStyle = 'rgba(43,29,16,0.05)';
  const t = s.audioTime * 18;
  for (let i = 0; i < 7; i++) {
    const x = ((i * 97 + t) % (L.w + 60)) - 30;
    const y = (i * 131) % L.h;
    paw(ctx, x, y, 12);
  }
}

function drawLanes(ctx, L) {
  // Faint column dividers, with a stronger line splitting the two dogs' halves.
  ctx.strokeStyle = 'rgba(43,29,16,0.06)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    if (i === 2) continue;
    ctx.beginPath();
    ctx.moveTo(i * L.w / 4, 0);
    ctx.lineTo(i * L.w / 4, L.h);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(43,29,16,0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(L.w / 2, 0);
  ctx.lineTo(L.w / 2, L.h);
  ctx.stroke();
}

// The 4 catch pads (each dog's two positions). Empty pads show where a dog can
// move; the pad a dog is steering to glows, and flashes on tap.
function drawPads(ctx, L, s) {
  const keys = ['A', 'S', 'D', 'F'];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let col = 0; col < 4; col++) {
    const side = col < 2 ? 0 : 1;
    const slot = col % 2;
    const cx = L.colCx[col];
    const active = s.dogTarget[side] === slot;
    const flash = active ? (s.tapFlash[side] || 0) : 0;
    const rx = L.dogR * 1.15;
    const ry = L.dogR * 0.4;
    ctx.fillStyle = `rgba(184,134,46,${(active ? 0.26 : 0.1) + flash * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(cx, L.hitY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = active ? 3 + flash * 4 : 1.5;
    ctx.strokeStyle = `rgba(140,100,32,${active ? 0.5 + flash * 0.5 : 0.22})`;
    ctx.beginPath();
    ctx.ellipse(cx, L.hitY, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Key-cap hint below the pad so the keyboard control is obvious.
    const kw = 26;
    const ky = L.h * 0.94;
    ctx.fillStyle = active ? 'rgba(184,134,46,0.95)' : 'rgba(255,255,255,0.92)';
    roundRect(ctx, cx - kw / 2, ky - kw / 2, kw, kw, 6);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(43,29,16,0.25)';
    roundRect(ctx, cx - kw / 2, ky - kw / 2, kw, kw, 6);
    ctx.stroke();
    ctx.fillStyle = active ? '#fff' : 'rgba(43,29,16,0.7)';
    ctx.font = '800 14px Fredoka, sans-serif';
    ctx.fillText(keys[col], cx, ky + 1);
  }
}

function drawTreats(ctx, L, s) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const r = L.treatR;
  for (const tr of s.treats) {
    if (tr.judged) continue;
    const prog = (s.audioTime - (tr.time - s.fallTime)) / s.fallTime;
    if (prog < 0 || prog > 1.25) continue;
    const x = L.colCx[tr.side * 2 + tr.slot];
    const y = L.topY + (L.hitY - L.topY) * prog;
    // Plate behind the treat so it reads crisply against the background.
    ctx.beginPath();
    ctx.arc(x, y, r * 1.05, 0, Math.PI * 2);
    if (tr.type === 'decoy') {
      ctx.fillStyle = 'rgba(224,86,59,0.18)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#E0563B';
      ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(43,29,16,0.12)';
      ctx.stroke();
    }
    ctx.font = `${r * 1.4}px ${EMOJI_FONT}`;
    ctx.fillText(tr.emoji, x, y);
  }
}

function drawDogs(ctx, L, s) {
  for (let side = 0; side < 2; side++) {
    const d = s.dogsState[side];
    const char = side === 0 ? s.leftChar : s.rightChar;
    // Slide between the side's two column centres by the animated dog position.
    const a = L.colCx[side * 2];
    const b = L.colCx[side * 2 + 1];
    const x = a + (b - a) * s.dogPos[side];
    const bob = Math.sin(s.audioTime * Math.PI * 2 * (s.bps || 2)) * 4 + d.bob;
    drawDog(ctx, x, L.hitY + bob, L.dogR, char, {
      mouthOpen: d.mouthOpen,
      blink: d.blink,
    });
  }
}

function drawParticles(ctx, s) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of s.particles) {
    const a = p.life / p.maxLife;
    ctx.globalAlpha = a;
    if (p.emoji) {
      ctx.font = `${p.size}px ${EMOJI_FONT}`;
      ctx.fillText(p.emoji, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawPopups(ctx, s) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of s.popups) {
    const a = Math.min(1, p.life / (p.maxLife * 0.5));
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.font = `700 ${p.size}px Fredoka, sans-serif`;
    ctx.fillText(p.text, p.x, p.y - (1 - p.life / p.maxLife) * 30);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, L, s) {
  // Happiness bar
  const pad = 14;
  const barW = L.w - pad * 2;
  const barH = 14;
  ctx.fillStyle = 'rgba(43,29,16,0.12)';
  roundRect(ctx, pad, pad, barW, barH, 7);
  ctx.fill();
  const hp = Math.max(0, s.happiness) / 100;
  ctx.fillStyle = hp > 0.3 ? BRAND.green : '#E0563B';
  roundRect(ctx, pad, pad, barW * hp, barH, 7);
  ctx.fill();
  ctx.font = '700 13px Fredoka, sans-serif';
  ctx.fillStyle = BRAND.brown;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('🐾 Happiness', pad, pad + barH + 4);

  // Score
  ctx.textAlign = 'right';
  ctx.font = '800 26px Fredoka, sans-serif';
  ctx.fillStyle = BRAND.brown;
  ctx.fillText(String(s.score).padStart(6, '0'), L.w - pad, pad + barH + 2);

  // Combo
  if (s.combo > 1) {
    ctx.textAlign = 'center';
    ctx.fillStyle = BRAND.gold;
    const pulse = 1 + Math.max(0, s.comboPulse) * 0.4;
    ctx.font = `800 ${Math.round(30 * pulse)}px Fredoka, sans-serif`;
    ctx.fillText(`${s.combo}x`, L.w / 2, L.h * 0.42);
    ctx.font = '600 13px Nunito, sans-serif';
    ctx.fillStyle = BRAND.brownSoft;
    ctx.fillText('COMBO', L.w / 2, L.h * 0.42 + 26);
  }
}

function paw(ctx, x, y, r) {
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.7, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.ellipse(x + i * r * 0.55, y - r * 0.8, r * 0.22, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
