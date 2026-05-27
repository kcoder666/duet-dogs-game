// Touch / mouse / keyboard input. The play area is split into 4 columns; a
// tap on a column steers that side's dog to that position. Calls onTap(column)
// with column 0..3 (0,1 = left dog's two spots; 2,3 = right dog's). Supports
// simultaneous two-finger taps (one per dog).
//
// Keys: A/S = left dog left/right, D/F = right dog left/right (digits 1-4 too).

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

  // A/S/D/F → columns 0 1 2 3 (left dog: A/S, right dog: D/F); digits 1-4 too.
  const keyMap = { a: 0, s: 1, d: 2, f: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const col = keyMap[e.key.toLowerCase()];
    if (col !== undefined) onTap(col);
  });
}
