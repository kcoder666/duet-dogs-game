// Touch / mouse / keyboard input. Maps the left half of the play area to
// lane 0 and the right half to lane 1, supporting simultaneous two-finger
// taps. Calls onTap(lane) on each fresh press.

export function attachInput(canvas, onTap) {
  const laneFor = (clientX) => {
    const rect = canvas.getBoundingClientRect();
    return clientX - rect.left < rect.width / 2 ? 0 : 1;
  };

  const press = (clientX) => onTap(laneFor(clientX));

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) press(t.clientX);
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    press(e.clientX);
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'f' || k === 'arrowleft') onTap(0);
    else if (k === 'j' || k === 'arrowright') onTap(1);
  });
}
