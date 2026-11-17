// ROOTBOUND — deterministic screenshot staging via ?shot=.
// One job: build a fixed, readable scene for each of the four screenshots.
// The game is frozen afterwards: no simulation, no input, just the staged frame.

import { BOONS } from './config.js';

function smoothPath(points) {
  // Insert midpoints so the root polyline looks grown, not polygonal.
  const out = [];
  for (let i = 0; i < points.length; i++) {
    out.push(points[i]);
    if (i + 1 < points.length) {
      out.push([(points[i][0] + points[i + 1][0]) / 2, (points[i][1] + points[i + 1][1]) / 2]);
    }
  }
  return out;
}

// A winding descent that threads past rocks and through water pockets.
function descentPath(x0, y0, x1, y1, wobble, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t + Math.sin(t * Math.PI * 3 + wobble) * 90 * (1 - t * 0.4);
    const y = y0 + (y1 - y0) * t;
    pts.push([Math.round(x), Math.round(y)]);
  }
  return pts;
}

export function stageShot(g, shot) {
  g.frozen = true;
  const seed = 20261117;
  g.startRun(seed);

  if (shot === 'start') {
    g.state = 'title';
    g.camY = -140;
    g.bestDepthM = 231;
    return;
  }

  // Shared mid-game staging: a healthy run at 231 m in the Gravel layer.
  g.stageGrowPath(smoothPath(descentPath(640, 20, 560, 700, 0.6, 26)));
  // Branch near 120 m and send the second tip down-left, staying on screen.
  // (roots.branch() is the raw split; the energy cost is enforced by doBranch in live play.)
  g.roots.branch();
  g.stageGrowPath(smoothPath(descentPath(600, 730, 470, 1240, 2.1, 14)));
  // Back to the main tip; push it down to 231 m (1386 px).
  g.roots.activeId = 1;
  g.stageGrowPath(smoothPath(descentPath(560, 700, 700, 1386, 4.2, 24)));
  // Grubs placed where the camera can see them: scan each root for a point
  // inside the viewport band, so the shot shows the pest mechanic.
  function grubOnScreen(rootId, yMin, yMax) {
    const root = g.roots.roots.find((r) => r.id === rootId);
    if (!root) return;
    const len = g.roots.lengthOf(root);
    for (let d = 120; d < len - 40; d += 15) {
      const p = g.roots.pointAt(root, d);
      if (p.y >= yMin && p.y <= yMax && p.x > 240 && p.x < 1040) {
        g.world.grubs.push({ rootId, dist: d, size: 10, speed: 12, wiggle: 1.3 });
        return;
      }
    }
  }
  grubOnScreen(1, 1150, 1450);
  grubOnScreen(2, 1050, 1300);
  g.energy = 62;
  g.waterCollected = 9; g.dewCollected = 5; g.nutrientsCollected = 3; g.grubsSquashed = 2;
  g.elapsedSec = 161;
  g.score = 231 * 10 + 9 * 15 + 3 * 50 + 2 * 20;
  g.maxDepthPx = 1386;
  g.camY = 986; g.camTarget = 986;

  if (shot === 'play') {
    g.state = 'playing';
    return;
  }
  if (shot === 'win') {
    // The main root reaches the spring: extend it down through the Deep Dark.
    g.roots.activeId = 1;
    g.stageGrowPath(smoothPath(descentPath(700, 1386, 640, 2920, 5.6, 46)));
    g.maxDepthPx = 3000;
    g.energy = 41;
    g.waterCollected = 21; g.dewCollected = 11; g.nutrientsCollected = 8; g.grubsSquashed = 6;
    g.elapsedSec = 482;
    g.timeBonus = Math.max(0, 1500 - 482 * 2);
    g.score = 500 * 10 + 21 * 15 + 8 * 50 + 6 * 20 + g.timeBonus;
    g.camY = 2260; g.camTarget = 2260;
    g.state = 'won';
    return;
  }
  if (shot === 'loss') {
    g.energy = 0;
    g.elapsedSec = 233;
    g.score = 187 * 10 + 7 * 15 + 2 * 50 + 1 * 20;
    g.maxDepthPx = 1122;
    g.camY = 722; g.camTarget = 722;
    g.state = 'lost';
    return;
  }
  // Unknown shot name: fall back to the title.
  g.state = 'title';
}

// Boon staging for a manual check (not a screenshot): ?shot=boon
export function stageBoon(g) {
  stageShot(g, 'play');
  g.boonChoices = [BOONS[0], BOONS[2], BOONS[4]];
  g.state = 'boon';
  g.frozen = false;
}
