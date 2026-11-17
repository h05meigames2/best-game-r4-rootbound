// ROOTBOUND — keyboard and pointer input.
// One job: track the pointer, held keys and clicks, and translate screen to world coords.

export function createInput(canvas, hooks) {
  const state = {
    pointerX: 640, pointerY: 360, pointerDown: false,
    pointerMovedAt: 0, keys: new Set(), clickQueue: [],
  };

  function toLocal(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x: sx, y: sy };
  }

  canvas.addEventListener('pointermove', (e) => {
    const p = toLocal(e);
    state.pointerX = p.x; state.pointerY = p.y;
    state.pointerMovedAt = performance.now();
  });
  canvas.addEventListener('pointerdown', (e) => {
    const p = toLocal(e);
    state.pointerX = p.x; state.pointerY = p.y;
    state.pointerDown = true;
    state.pointerMovedAt = performance.now();
    hooks.onPress(p.x, p.y);
  });
  window.addEventListener('pointerup', (e) => {
    const wasDown = state.pointerDown;
    state.pointerDown = false;
    if (wasDown) {
      const p = toLocal(e);
      state.clickQueue.push({ x: p.x, y: p.y });
    }
  });
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!e.repeat) hooks.onKey(e.key);
    state.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  });
  window.addEventListener('keyup', (e) => {
    state.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    state,
    // Arrow-key steering vector, or null when no arrow is held.
    steerVector() {
      let x = 0, y = 0;
      if (state.keys.has('ArrowLeft') || state.keys.has('a')) x -= 1;
      if (state.keys.has('ArrowRight') || state.keys.has('d')) x += 1;
      if (state.keys.has('ArrowUp') || state.keys.has('w')) y -= 1;
      if (state.keys.has('ArrowDown') || state.keys.has('s')) y += 1;
      if (x === 0 && y === 0) return null;
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    growingHeld() {
      return state.pointerDown || this.steerVector() !== null;
    },
    // Drain one queued click per frame so a single tap never fires twice.
    takeClick() { return state.clickQueue.shift() || null; },
  };
}
