// ROOTBOUND — the underground world: layers, rocks, water, dew, nutrients, grubs.
// One job: generate the soil deterministically from a seed and answer spatial queries.

import { LAYERS, WORLD_W, WORLD_DEPTH_PX, SEED_X } from './config.js';
import { mulberry32, range, int } from './random.js';

function makeRock(rng, y0, y1) {
  const r = range(rng, 26, 58);
  const cx = range(rng, 70, WORLD_W - 70);
  const cy = range(rng, y0 + 50, y1 - 40);
  const verts = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * range(rng, 0.75, 1.1);
    verts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.85 });
  }
  return { cx, cy, r, verts, seed: rng() * 10 };
}

function farFromRocks(x, y, rocks, pad) {
  for (const rk of rocks) {
    const dx = x - rk.cx, dy = y - rk.cy;
    if (dx * dx + dy * dy < (rk.r + pad) * (rk.r + pad)) return false;
  }
  return true;
}

export function createWorld(seed) {
  const rng = mulberry32(seed);
  const rocks = [];
  const waters = [];
  const dews = [];
  const nutrients = [];
  const speckles = [];

  for (const layer of LAYERS) {
    for (let i = 0; i < layer.rocks; i++) rocks.push(makeRock(rng, layer.y0, layer.y1));
    const place = (arr, count, rMin, rMax, pad) => {
      let placed = 0, tries = 0;
      while (placed < count && tries < count * 12) {
        tries++;
        const x = range(rng, 60, WORLD_W - 60);
        const y = range(rng, layer.y0 + 60, layer.y1 - 50);
        if (!farFromRocks(x, y, rocks, pad)) continue;
        arr.push({ x, y, r: range(rng, rMin, rMax), phase: rng() * Math.PI * 2, taken: false });
        placed++;
      }
    };
    place(waters, layer.water, 16, 26, 34);
    place(dews, layer.dew, 7, 10, 26);
    place(nutrients, layer.nutrients, 9, 12, 30);
    // Deterministic soil speckles, drawn only when their band is on screen.
    for (let i = 0; i < 520; i++) {
      speckles.push({
        x: range(rng, 0, WORLD_W), y: range(rng, layer.y0, layer.y1),
        r: range(rng, 1, 3.2), a: range(rng, 0.12, 0.4), layer: layer.name,
      });
    }
  }

  // The Deep Spring: the glowing pool at the bottom that ends the run in a win.
  const spring = { x: WORLD_W / 2, y: WORLD_DEPTH_PX - 60, r: 150 };
  // Keep the spring clear: no rock may sit on the goal.
  for (let i = rocks.length - 1; i >= 0; i--) {
    const rk = rocks[i];
    if (Math.hypot(rk.cx - spring.x, rk.cy - spring.y) < spring.r + 90) rocks.splice(i, 1);
  }

  return {
    seed, rocks, waters, dews, nutrients, speckles, spring,
    grubs: [], // {rootId, dist, size, speed, wiggle}
    grubTimer: 8,
    nearestWater(x, y, maxDist) {
      let best = null, bestD = maxDist;
      for (const w of this.waters) {
        if (w.taken) continue;
        const d = Math.hypot(w.x - x, w.y - y);
        if (d < bestD) { bestD = d; best = w; }
      }
      return best;
    },
    rockAt(x, y, pad) {
      for (const rk of this.rocks) {
        const dx = x - rk.cx, dy = y - rk.cy;
        if (dx * dx + dy * dy < (rk.r + pad) * (rk.r + pad)) return rk;
      }
      return null;
    },
    // The seed's own clearing: no rocks near the start, so the first seconds are safe.
    clearStart() {
      for (let i = this.rocks.length - 1; i >= 0; i--) {
        const rk = this.rocks[i];
        if (rk.cy < 220 && Math.abs(rk.cx - SEED_X) < 220) this.rocks.splice(i, 1);
      }
    },
  };
}
