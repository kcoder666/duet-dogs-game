// The ScoutPaw pack + a parametric canvas dog renderer.
// Art is original (cute, breed-suggestive) — not copied from scoutpaw.tv.

export const PACK = [
  {
    id: 'max', name: 'Max', breed: 'Golden Retriever', ears: 'floppy',
    fur: '#E8B964', furDark: '#CE9B43', snout: '#F6D89A', nose: '#3A2A18',
    accent: '#B8862E', voice: 0.22, blurb: 'Every stranger is a friend who hasn’t said hi yet.',
  },
  {
    id: 'rocky', name: 'Rocky', breed: 'Husky', ears: 'pointy',
    fur: '#9FB4C4', furDark: '#6E8597', snout: '#F2F6F9', nose: '#26313A',
    accent: '#397FC5', voice: 0.34, blurb: 'Born to run, built for snow days.',
  },
  {
    id: 'oscar', name: 'Oscar', breed: 'Collie', ears: 'semi',
    fur: '#C98A4B', furDark: '#9E6A33', snout: '#FBF1E2', nose: '#3A2A18',
    accent: '#9E6A33', voice: 0.5, blurb: 'The thoughtful one who herds the whole pack.',
  },
  {
    id: 'buddy', name: 'Buddy', breed: 'Corgi', ears: 'big',
    fur: '#E89B5A', furDark: '#C77A38', snout: '#FBEEDD', nose: '#3A2A18',
    accent: '#C77A38', voice: 0.62, blurb: 'Short legs, big heart, bigger appetite.',
  },
  {
    id: 'bella', name: 'Bella', breed: 'Poodle', ears: 'curly',
    fur: '#F4E3CE', furDark: '#E0C7A6', snout: '#FFF8EE', nose: '#3A2A18',
    accent: '#F4A6B8', voice: 0.85, blurb: 'Fancy floof with a flair for the dramatic.',
  },
];

export function getCharacter(id) {
  return PACK.find((c) => c.id === id) || PACK[0];
}

// Draw a cute dog head centred at (cx, cy). r = head radius in px.
// state: { mouthOpen 0..1, blink 0..1, bob 0..1 } all optional.
export function drawDog(ctx, cx, cy, r, c, state = {}) {
  const mouth = state.mouthOpen || 0;
  const blink = state.blink || 0;
  ctx.save();
  ctx.translate(cx, cy);

  drawEars(ctx, r, c);

  // Head
  ctx.fillStyle = c.fur;
  roundedHead(ctx, r);
  ctx.fill();

  // Face patch / lighter muzzle area
  ctx.fillStyle = c.snout;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.28, r * 0.62, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  const eyeY = -r * 0.12;
  const eyeX = r * 0.42;
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(sx * eyeX, eyeY, r * 0.2, r * 0.24 * (1 - blink), 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink < 0.6) {
      ctx.fillStyle = c.nose;
      ctx.beginPath();
      ctx.arc(sx * eyeX + r * 0.04, eyeY + r * 0.03, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx * eyeX + r * 0.08, eyeY - r * 0.02, r * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Cheek blush
  ctx.fillStyle = 'rgba(244,166,184,0.55)';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * r * 0.6, r * 0.22, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nose
  ctx.fillStyle = c.nose;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.05, r * 0.16, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth / open-when-catching
  ctx.strokeStyle = c.nose;
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.lineCap = 'round';
  if (mouth > 0.05) {
    const mh = r * 0.4 * mouth;
    ctx.fillStyle = c.nose;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.34, r * 0.26, mh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.34 + mh * 0.35, r * 0.16, mh * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.18);
    ctx.lineTo(0, r * 0.3);
    ctx.moveTo(0, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.16, r * 0.4, -r * 0.26, r * 0.32);
    ctx.moveTo(0, r * 0.3);
    ctx.quadraticCurveTo(r * 0.16, r * 0.4, r * 0.26, r * 0.32);
    ctx.stroke();
  }

  ctx.restore();
}

function roundedHead(ctx, r) {
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.95, r, 0, 0, Math.PI * 2);
}

function drawEars(ctx, r, c) {
  ctx.fillStyle = c.furDark;
  const e = c.ears;
  if (e === 'pointy' || e === 'semi') {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * r * 0.55, -r * 0.55);
      ctx.lineTo(sx * r * 1.05, -r * 1.45);
      ctx.lineTo(sx * r * 0.2, -r * 0.85);
      ctx.closePath();
      ctx.fill();
    }
    if (e === 'semi') {
      ctx.fillStyle = c.fur;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * r * 0.7, -r * 0.95, r * 0.28, r * 0.18, sx * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (e === 'big') {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * r * 0.75, -r * 0.95, r * 0.34, r * 0.6, sx * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.snout;
      ctx.beginPath();
      ctx.ellipse(sx * r * 0.75, -r * 0.85, r * 0.18, r * 0.38, sx * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.furDark;
    }
  } else if (e === 'curly') {
    for (const sx of [-1, 1]) {
      ctx.fillStyle = c.furDark;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(sx * r * (0.7 + i * 0.06), -r * (0.7 + i * 0.18), r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    // floppy
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * r * 0.85, -r * 0.1, r * 0.34, r * 0.7, sx * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
