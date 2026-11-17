// DEEPROOT — the game itself: state machine, growth, pickups, grubs, boons, win/loss.
// One job: turn input + world + roots into a complete, winnable game.

import {
  VIEW_W, VIEW_H, PX_PER_M, WORLD_W, WORLD_DEPTH_PX, WIN_DEPTH_M,
  ENERGY_START, ENERGY_MAX, WATER_ENERGY, DEW_ENERGY, NUTRIENT_ENERGY,
  BRANCH_COST, ROCK_BUMP_COST, GROW_SPEED, MAX_TIPS,
  SCORE_PER_M, SCORE_WATER, SCORE_NUTRIENT, SCORE_GRUB,
  WIN_TIME_BONUS, WIN_TIME_BONUS_PER_SEC,
  LAYERS, BOONS, layerAt, layerIndexAt,
} from './config.js';
import { createWorld } from './world.js';
import { createRootSystem } from './roots.js';
import { createAudio } from './audio.js';
import { render, pointInButton } from './render.js';
import { mulberry32, shuffle } from './random.js';

export function createGame(canvas, input) {
  const audio = createAudio();
  const g = {
    state: 'title', // title | playing | paused | boon | won | lost
    audio,
    world: null,
    roots: null,
    energy: ENERGY_START, energyMax: ENERGY_MAX,
    score: 0, waterCollected: 0, dewCollected: 0, nutrientsCollected: 0,
    grubsSquashed: 0, timeBonus: 0,
    maxDepthPx: 0, elapsedSec: 0, runCount: 0,
    camY: -140, camTarget: -140,
    growSpeedMul: 1, branchCostMul: 1, branchFree: false,
    stoneSoftener: 0, grubBane: false, rainSense: false,
    boonChoices: [], lastLayerIdx: 0,
    buttons: [], hoverId: null,
    bestDepthM: 0, bestScore: 0,
    frozen: false, // shot mode: render a staged scene, no simulation
    _rockCooldown: 0, _grubEatAcc: 0,
  };

  function newRun(seed) {
    g.world = createWorld(seed);
    g.world.clearStart();
    g.roots = createRootSystem();
    g.energy = ENERGY_START; g.energyMax = ENERGY_MAX;
    g.score = 0; g.waterCollected = 0; g.dewCollected = 0;
    g.nutrientsCollected = 0; g.grubsSquashed = 0; g.timeBonus = 0;
    g.maxDepthPx = 0; g.elapsedSec = 0;
    g.camY = -140; g.camTarget = -140;
    g.growSpeedMul = 1; g.branchCostMul = 1; g.branchFree = false;
    g.stoneSoftener = 0; g.grubBane = false; g.rainSense = false;
    g.boonChoices = []; g.lastLayerIdx = 0;
    g._rockCooldown = 0;
  }

  function depthM() { return Math.floor(g.maxDepthPx / PX_PER_M); }

  function recomputeScore() {
    g.score = depthM() * SCORE_PER_M
      + g.waterCollected * SCORE_WATER
      + g.nutrientsCollected * SCORE_NUTRIENT
      + g.grubsSquashed * SCORE_GRUB
      + g.timeBonus;
  }

  function startRun(seed) {
    g.runCount++;
    newRun(seed === undefined ? (Math.random() * 1e9) | 0 : seed);
    g.state = 'playing';
    audio.unlock();
    audio.click();
  }

  function doBranch() {
    if (g.state !== 'playing') return;
    if (g.roots.aliveCount >= MAX_TIPS) return;
    const cost = g.branchFree ? 0 : Math.ceil(BRANCH_COST * g.branchCostMul);
    if (g.energy < cost) return;
    g.energy -= cost;
    g.branchFree = false;
    g.roots.branch();
    audio.branch();
  }

  function applyBoon(i) {
    const b = g.boonChoices[i];
    if (!b) return;
    b.apply(g);
    audio.boon();
    g.boonChoices = [];
    g.state = 'playing';
  }

  function offerBoon() {
    const rng = mulberry32((Math.random() * 1e9) | 0);
    g.boonChoices = shuffle(rng, BOONS).slice(0, 3);
    g.state = 'boon';
    audio.boon();
  }

  function winRun() {
    g.state = 'won';
    g.timeBonus = Math.max(0, Math.round(WIN_TIME_BONUS - g.elapsedSec * WIN_TIME_BONUS_PER_SEC));
    recomputeScore();
    g.bestScore = Math.max(g.bestScore, g.score);
    audio.win();
  }

  function loseRun() {
    g.state = 'lost';
    g.bestDepthM = Math.max(g.bestDepthM, depthM());
    audio.wither();
  }

  // ---- growth ------------------------------------------------------------
  function growthStep(dt) {
    const root = g.roots.active;
    if (!root || !root.alive) return;
    const tip = g.roots.tipOf(root);
    const steer = input.steerVector();
    let tx, ty;
    if (steer) { tx = tip.x + steer.x * 120; ty = tip.y + steer.y * 120; }
    else { tx = input.state.pointerX; ty = input.state.pointerY + g.camY; }
    let dx = tx - tip.x, dy = ty - tip.y;
    const len = Math.hypot(dx, dy);
    if (len < 4) return;
    dx /= len; dy /= len;
    if (dy < -0.2) { // roots reach down and sideways, never far up
      dy = -0.2;
      const l2 = Math.hypot(dx, dy); dx /= l2; dy /= l2;
    }
    const step = GROW_SPEED * g.growSpeedMul * dt;
    let nx = Math.max(30, Math.min(WORLD_W - 30, tip.x + dx * step));
    let ny = Math.min(WORLD_DEPTH_PX - 8, tip.y + dy * step);
    let rock = g.world.rockAt(nx, ny, 5);
    if (rock) {
      // Walk around the stone: probe sideways along its edge at growing
      // offsets, so a root flows around a rock instead of jamming into it.
      // A plain small rotation cannot escape a rock the tip drove into head-on.
      let slid = false;
      const px = -dy, py = dx; // perpendicular to the growth direction
      // Keep sliding the same way as the last frame: switching sides every
      // frame draws switchbacks that burn energy without going anywhere.
      const signs = g._slideSign === -1 ? [-1, 1] : [1, -1];
      for (const lateral of [18, 36, 54, 80]) {
        for (const sign of signs) {
          const sx = Math.max(30, Math.min(WORLD_W - 30, tip.x + px * sign * lateral + dx * step * 0.6));
          const sy = Math.min(WORLD_DEPTH_PX - 8, tip.y + py * sign * lateral + dy * step * 0.6);
          if (!g.world.rockAt(sx, sy, 5)) { nx = sx; ny = sy; rock = null; slid = true; g._slideSign = sign; break; }
        }
        if (slid) break;
      }
      if (!slid) rock = g.world.rockAt(nx, ny, 5);
    }
    if (rock) {
      if (g.stoneSoftener > 0) {
        g.stoneSoftener--;
        g.world.rocks.splice(g.world.rocks.indexOf(rock), 1);
        audio.rock();
        g.energy = Math.max(0, g.energy - ROCK_BUMP_COST);
      } else {
        if (g._rockCooldown <= 0) {
          audio.rock();
          g.energy = Math.max(0, g.energy - ROCK_BUMP_COST);
          g._rockCooldown = 0.35;
        }
        return;
      }
    }
    const grown = g.roots.grow(root, nx, ny);
    if (grown > 0) {
      const layer = layerAt(ny);
      g.energy -= grown * layer.growthCost;
      audio.tryTick(performance.now());
      if (ny > g.maxDepthPx) g.maxDepthPx = ny;
      checkPickups(nx, ny);
      // Layer boundary crossed: pause and offer a boon.
      const li = layerIndexAt(g.maxDepthPx);
      if (li > g.lastLayerIdx) {
        g.lastLayerIdx = li;
        recomputeScore();
        offerBoon();
        return;
      }
      if (ny >= WORLD_DEPTH_PX - 44) { recomputeScore(); winRun(); return; }
      if (g.energy <= 0) { g.energy = 0; recomputeScore(); loseRun(); return; }
      recomputeScore();
    }
  }

  function checkPickups(x, y) {
    for (const w of g.world.waters) {
      if (!w.taken && Math.hypot(w.x - x, w.y - y) < w.r + 12) {
        w.taken = true;
        g.waterCollected++;
        g.energy = Math.min(g.energyMax, g.energy + WATER_ENERGY);
        audio.water();
      }
    }
    for (const d of g.world.dews) {
      if (!d.taken && Math.hypot(d.x - x, d.y - y) < d.r + 10) {
        d.taken = true;
        g.dewCollected++;
        g.energy = Math.min(g.energyMax, g.energy + DEW_ENERGY);
        audio.dew();
      }
    }
    for (const n of g.world.nutrients) {
      if (!n.taken && Math.hypot(n.x - x, n.y - y) < n.r + 12) {
        n.taken = true;
        g.nutrientsCollected++;
        g.energy = Math.min(g.energyMax, g.energy + NUTRIENT_ENERGY);
        audio.nutrient();
      }
    }
  }

  // ---- grubs -------------------------------------------------------------
  function updateGrubs(dt) {
    const layer = layerAt(g.maxDepthPx);
    g.world.grubTimer -= dt;
    if (g.world.grubTimer <= 0) {
      g.world.grubTimer = layer.grubEverySec * (0.8 + Math.random() * 0.4);
      const alive = g.roots.roots.filter((r) => r.alive && g.roots.lengthOf(r) > 130);
      if (alive.length > 0 && g.world.grubs.length < layer.maxGrubs) {
        const root = alive[(Math.random() * alive.length) | 0];
        const len = g.roots.lengthOf(root);
        g.world.grubs.push({
          rootId: root.id, dist: 40 + Math.random() * (len - 80),
          size: 10, speed: 11 + layerIndexAt(g.maxDepthPx) * 1.5,
          wiggle: Math.random() * 10,
        });
        audio.grubSpawn();
      }
    }
    for (let i = g.world.grubs.length - 1; i >= 0; i--) {
      const grub = g.world.grubs[i];
      const root = g.roots.roots.find((r) => r.id === grub.rootId);
      if (!root || !root.alive) { g.world.grubs.splice(i, 1); continue; }
      if (g.grubBane) { g.world.grubs.splice(i, 1); continue; }
      grub.dist -= grub.speed * dt;
      g._grubEatAcc += dt;
      if (g._grubEatAcc > 0.4) {
        g._grubEatAcc = 0;
        // The grub withers the tip end back, a nibble at a time.
        if (g.roots.nibbleTip(root, 6)) { g.world.grubs.splice(i, 1); continue; }
      }
      if (grub.dist <= 12 || grub.dist >= g.roots.lengthOf(root)) {
        // Reached the base, or the root withered past the grub: the root dies.
        root.alive = false;
        g.world.grubs.splice(i, 1);
        continue;
      }
      g.roots.pruneDead();
      if (g.roots.aliveCount === 0) { loseRun(); return; }
    }
  }

  function squashGrubAt(sx, sy) {
    for (let i = 0; i < g.world.grubs.length; i++) {
      const grub = g.world.grubs[i];
      const root = g.roots.roots.find((r) => r.id === grub.rootId);
      if (!root) continue;
      const p = g.roots.pointAt(root, grub.dist);
      if (Math.hypot(p.x - sx, p.y - g.camY - sy) < 24) {
        g.world.grubs.splice(i, 1);
        g.grubsSquashed++;
        recomputeScore();
        audio.squash();
        return true;
      }
    }
    return false;
  }

  // ---- clicks & keys -----------------------------------------------------
  function handleButton(id) {
    switch (id) {
      case 'start': startRun(); break;
      case 'restart': startRun(); break;
      case 'resume': g.state = 'playing'; audio.click(); break;
      case 'pause': if (g.state === 'playing') { g.state = 'paused'; audio.click(); } break;
      case 'mute': case 'mute2': audio.toggleMute(); break;
      case 'branch': doBranch(); break;
      default:
        if (id.startsWith('boon')) applyBoon(Number(id.slice(4)));
    }
  }

  function handleClick(x, y) {
    const id = pointInButton(g, x, y);
    if (id) { handleButton(id); return; }
    if (g.state !== 'playing') return;
    const wx = x, wy = y + g.camY;
    if (squashGrubAt(x, y)) return;
    g.roots.activateAt(wx, wy);
  }

  function handleKey(key) {
    audio.unlock();
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (k === 'm') { audio.toggleMute(); return; }
    if (g.state === 'title' && (k === 'enter' || k === ' ')) { startRun(); return; }
    if ((g.state === 'won' || g.state === 'lost') && (k === 'enter' || k === 'r' || k === ' ')) { startRun(); return; }
    if (k === 'p' || k === 'escape') {
      if (g.state === 'playing') g.state = 'paused';
      else if (g.state === 'paused') g.state = 'playing';
      return;
    }
    if (g.state === 'paused' && k === 'r') { startRun(); return; }
    if (g.state === 'boon' && ['1', '2', '3'].includes(k)) { applyBoon(Number(k) - 1); return; }
    if (g.state === 'playing' && (k === ' ' || k === 'b')) doBranch();
  }

  // ---- per-frame ---------------------------------------------------------
  function update(dt, now) {
    g.hoverId = pointInButton(g, input.state.pointerX, input.state.pointerY);
    let click;
    while ((click = input.takeClick())) handleClick(click.x, click.y);
    if (g.state === 'playing' && !g.frozen) {
      g.elapsedSec += dt;
      g._rockCooldown = Math.max(0, g._rockCooldown - dt);
      if (input.growingHeld()) growthStep(dt);
      if (g.state === 'playing') updateGrubs(dt);
      // Camera follows the deepest tip, eased.
      const tip = g.roots.active ? g.roots.tipOf(g.roots.active) : { y: 0 };
      const deepest = Math.max(g.maxDepthPx, tip.y);
      g.camTarget = Math.max(-140, Math.min(WORLD_DEPTH_PX - VIEW_H + 40, deepest - 400));
      g.camY += (g.camTarget - g.camY) * Math.min(1, dt * 4);
    } else if (g.state === 'title' && !g.frozen) {
      g.camY += (-140 - g.camY) * Math.min(1, dt * 2);
    }
  }

  // ---- staging helper for screenshots (deterministic, no input) ----------
  // Grow the active root along a scripted path, collecting what it touches.
  function stageGrowPath(points, collect = true) {
    const root = g.roots.active;
    for (const [x, y] of points) {
      g.roots.grow(root, x, y);
      if (y > g.maxDepthPx) g.maxDepthPx = y;
      if (collect) checkPickups(x, y);
    }
    recomputeScore();
  }

  newRun((Math.random() * 1e9) | 0);

  // The returned object IS the live game state: shots and the loop mutate it directly.
  Object.defineProperty(g, 'branchCost', {
    get() { return Math.ceil(BRANCH_COST * g.branchCostMul); },
  });
  g.startRun = startRun;
  g.doBranch = doBranch;
  g.applyBoon = applyBoon;
  g.handleKey = handleKey;
  g.update = update;
  g.stageGrowPath = stageGrowPath;
  g.renderFrame = (now) => render(canvas.getContext('2d'), g, now);

  return g;
}
