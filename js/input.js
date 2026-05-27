// Touch / mouse / keyboard input. The play area is split into 4 columns; a
// tap on a column steers that side's dog to that position. Calls onTap(column)
// with column 0..3 (0,1 = left dog's two spots; 2,3 = right dog's). Supports
// simultaneous two-finger taps (one per dog).
//
// Keys: A/S = left dog left/right, ←/→ = right dog left/right (digits 1-4 too).

export function attachInput(canvas, onTap) {
  const columnFor = (clientX) => {
    const rect = canvas.getBoundingClientRect();
    const frac = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(3, Math.floor(frac * 4)));
  };

  const press = (clientX) => onTap(columnFor(clientX));

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) press(t.clientX);
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    press(e.clientX);
  });

  // Left dog: A/S. Right dog: ← / → arrow keys. Digits 1-4 map all four columns.
  const keyMap = { a: 0, s: 1, arrowleft: 2, arrowright: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const col = keyMap[e.key.toLowerCase()];
    if (col !== undefined) { e.preventDefault(); onTap(col); }
  });
}
