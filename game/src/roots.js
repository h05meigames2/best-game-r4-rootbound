// DEEPROOT — the root system: tips, growth, branching, grub damage.
// One job: own every root's points and let the game grow, split and prune them.

import { SEED_X, SEED_Y } from './config.js';

// A root is a polyline from its base to its tip. Points are spaced ~7 px apart.
export function createRootSystem() {
  const roots = [];
  let nextId = 1;

  function addRoot(x, y) {
    const root = { id: nextId++, points: [{ x, y }], alive: true, bornAt: 0 };
    roots.push(root);
    return root;
  }

  const first = addRoot(SEED_X, SEED_Y);
  first.points.push({ x: SEED_X, y: SEED_Y + 14 });

  return {
    roots,
    activeId: first.id,
    get active() { return roots.find((r) => r.id === this.activeId) || roots[0]; },
    get aliveCount() { return roots.filter((r) => r.alive).length; },
    tipOf(root) { return root.points[root.points.length - 1]; },
    lengthOf(root) {
      let len = 0;
      for (let i = 1; i < root.points.length; i++) {
        len += Math.hypot(root.points[i].x - root.points[i - 1].x, root.points[i].y - root.points[i - 1].y);
      }
      return len;
    },
    // Point at a distance along the root from its base (for grub placement).
    pointAt(root, dist) {
      let d = 0;
      for (let i = 1; i < root.points.length; i++) {
        const a = root.points[i - 1], b = root.points[i];
        const seg = Math.hypot(b.x - a.x, b.y - a.y);
        if (d + seg >= dist) {
          const t = seg === 0 ? 0 : (dist - d) / seg;
          return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, index: i };
        }
        d += seg;
      }
      return { ...this.tipOf(root), index: root.points.length - 1 };
    },
    // Append a growth step; keeps points spaced so rendering stays smooth.
    // Always returns the distance actually moved, even for a sub-spacing
    // nudge that only moves the tip in place (60 fps steps are ~2.5 px).
    grow(root, nx, ny) {
      const tip = this.tipOf(root);
      const dist = Math.hypot(nx - tip.x, ny - tip.y);
      if (dist < 7) {
        tip.x = nx; tip.y = ny;
        return dist;
      }
      root.points.push({ x: nx, y: ny });
      return dist;
    },
    branch() {
      const parent = this.active;
      if (!parent || !parent.alive) return null;
      const tip = this.tipOf(parent);
      const child = addRoot(tip.x, tip.y);
      child.points.push({ x: tip.x, y: tip.y + 10 });
      this.activeId = child.id;
      return child;
    },
    activateAt(x, y, maxDist = 26) {
      let best = null, bestD = maxDist;
      for (const r of roots) {
        if (!r.alive) continue;
        const t = this.tipOf(r);
        const d = Math.hypot(t.x - x, t.y - y);
        if (d < bestD) { bestD = d; best = r; }
      }
      if (best) this.activeId = best.id;
      return best;
    },
    // A grub nibbles the root: each bite withers the tip end back by `px`.
    // (An earlier cut amputated the whole front past the grub in one bite —
    // far too brutal: one grub could erase minutes of growth.)
    // Returns true when the root has withered away entirely.
    nibbleTip(root, px) {
      let remove = px;
      while (remove > 0 && root.points.length > 1) {
        const tip = root.points[root.points.length - 1];
        const prev = root.points[root.points.length - 2];
        const seg = Math.hypot(tip.x - prev.x, tip.y - prev.y);
        if (seg <= remove) { root.points.pop(); remove -= seg; }
        else {
          const t = remove / seg;
          tip.x = tip.x + (prev.x - tip.x) * t;
          tip.y = tip.y + (prev.y - tip.y) * t;
          remove = 0;
        }
      }
      if (this.lengthOf(root) < 20) { root.alive = false; return true; }
      return false;
    },
    pruneDead() {
      for (let i = roots.length - 1; i >= 0; i--) {
        if (!roots[i].alive && roots[i].points.length <= 1 && roots[i].id !== 1) roots.splice(i, 1);
      }
      if (!roots.some((r) => r.id === this.activeId && r.alive)) {
        const alive = roots.find((r) => r.alive);
        if (alive) this.activeId = alive.id;
      }
    },
    reset() {
      roots.length = 0;
      nextId = 1;
      const first = addRoot(SEED_X, SEED_Y);
      first.points.push({ x: SEED_X, y: SEED_Y + 14 });
      this.activeId = first.id;
    },
  };
}
