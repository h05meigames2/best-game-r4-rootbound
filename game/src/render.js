// DEEPROOT — everything the player sees, drawn on one canvas.
// One job: paint the soil, the roots, the creatures, the HUD and every menu.

import {
  VIEW_W, VIEW_H, HUD_H, PX_PER_M, WORLD_W, WORLD_DEPTH_PX,
  LAYERS, layerAt, layerIndexAt, PALETTE, BOONS, WIN_DEPTH_M,
} from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, align = 'left', weight = 700, font = 'system-ui, sans-serif') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function button(ctx, g, id, x, y, w, h, label, opts = {}) {
  const hover = g.hoverId === id;
  ctx.fillStyle = opts.accent ? (hover ? '#ffd970' : PALETTE.accent) : (hover ? '#4a3823' : '#2e2318');
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = opts.accent ? '#7a5a20' : PALETTE.panelLine;
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, label, x + w / 2, y + h / 2 + 1, opts.size || 18, opts.accent ? '#241a08' : PALETTE.text, 'center');
  g.buttons.push({ id, x, y, w, h });
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- soil

function drawSoil(ctx, g, now) {
  const camY = g.camY;
  const top = camY - 140; // sky strip above the surface is visible near the top
  // Sky
  if (top < 0) {
    const grad = ctx.createLinearGradient(0, 0, 0, -top + 4);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, Math.min(VIEW_H, -top));
    // Sun and drifting clouds
    ctx.fillStyle = 'rgba(255, 244, 200, 0.95)';
    ctx.beginPath(); ctx.arc(1080, 62 - top * 0.4, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [cx, cy, r] of [[220, 70, 26], [300, 96, 20], [760, 48, 22]]) {
      ctx.beginPath(); ctx.arc(cx, cy - top * 0.3, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + r, cy - top * 0.3 + 6, r * 0.7, 0, Math.PI * 2); ctx.fill();
    }
    // Grass line at the surface
    ctx.fillStyle = '#5d8a3c';
    ctx.fillRect(0, -top, VIEW_W, 6);
    ctx.fillStyle = '#79a94e';
    for (let x = 0; x < VIEW_W; x += 14) {
      const h = 6 + ((x * 37) % 11);
      ctx.fillRect(x, -top - h, 3, h);
    }
  }
  // Soil bands
  for (const layer of LAYERS) {
    const y0 = layer.y0 - camY, y1 = layer.y1 - camY;
    if (y1 < 0 || y0 > VIEW_H) continue;
    const grad = ctx.createLinearGradient(0, Math.max(0, y0), 0, Math.min(VIEW_H, y1));
    grad.addColorStop(0, layer.soilTop);
    grad.addColorStop(1, layer.soilBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, Math.max(0, y0), VIEW_W, Math.min(VIEW_H, y1) - Math.max(0, y0));
    // Strata line + layer tag on the left edge
    if (y0 > 0 && y0 < VIEW_H) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, y0, VIEW_W, 3);
      text(ctx, `${layer.name} · ${layer.range}`, 16, y0 + 22, 13, layer.label, 'left', 800);
    }
  }
  // Speckles
  for (const s of g.world.speckles) {
    const sy = s.y - camY;
    if (sy < -4 || sy > VIEW_H + 4) continue;
    ctx.globalAlpha = s.a;
    ctx.fillStyle = LAYERS.find((l) => l.name === s.layer).speckle;
    ctx.beginPath(); ctx.arc(s.x, sy, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlant(ctx, g) {
  const camY = g.camY;
  if (camY > 170) return;
  const depthM = g.maxDepthPx / PX_PER_M;
  const stemH = Math.min(120, 14 + depthM * 0.24);
  const baseX = 640, baseY = -camY;
  ctx.strokeStyle = '#4e7a2e';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.quadraticCurveTo(baseX + 8, baseY - stemH * 0.6, baseX, baseY - stemH); ctx.stroke();
  const leaves = Math.min(6, 1 + Math.floor(depthM / 90));
  ctx.fillStyle = '#6fae44';
  for (let i = 0; i < leaves; i++) {
    const ly = baseY - 18 - i * 16;
    const side = i % 2 === 0 ? 1 : -1;
    ctx.beginPath();
    ctx.ellipse(baseX + side * 14, ly, 16, 7, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (depthM >= 480) {
    ctx.fillStyle = '#ffd94d';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(baseX + Math.cos(a) * 11, baseY - stemH - 4 + Math.sin(a) * 11, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ff9a3d';
    ctx.beginPath(); ctx.arc(baseX, baseY - stemH - 4, 7, 0, Math.PI * 2); ctx.fill();
  }
}

function drawSpring(ctx, g, now) {
  const s = g.world.spring;
  const sy = s.y - g.camY;
  if (sy < -200 || sy > VIEW_H + 200) return;
  const pulse = 0.5 + 0.5 * Math.sin(now / 700);
  const glow = ctx.createRadialGradient(s.x, sy, 10, s.x, sy, s.r + 40 + pulse * 20);
  glow.addColorStop(0, 'rgba(160, 220, 255, 0.85)');
  glow.addColorStop(0.55, 'rgba(80, 160, 220, 0.45)');
  glow.addColorStop(1, 'rgba(80, 160, 220, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(s.x - s.r - 70, sy - s.r - 70, (s.r + 70) * 2, (s.r + 70) * 2);
  ctx.fillStyle = PALETTE.springCore;
  ctx.beginPath(); ctx.ellipse(s.x, sy, s.r, 42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 7; i++) {
    const bx = s.x - 110 + i * 36 + Math.sin(now / 500 + i * 2) * 6;
    const by = sy - 26 + ((now / 900 + i * 0.37) % 1) * -30;
    ctx.beginPath(); ctx.arc(bx, by, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  text(ctx, 'THE DEEP SPRING · 500 m', s.x, sy + 62, 15, '#cfeeff', 'center', 800);
}

// ---------------------------------------------------------------- entities

function drawRocks(ctx, g) {
  for (const rk of g.world.rocks) {
    const y = rk.cy - g.camY;
    if (y < -80 || y > VIEW_H + 80) continue;
    ctx.fillStyle = PALETTE.rock;
    ctx.beginPath();
    rk.verts.forEach((v, i) => { if (i === 0) ctx.moveTo(v.x, v.y - g.camY); else ctx.lineTo(v.x, v.y - g.camY); });
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PALETTE.rockLight;
    ctx.beginPath();
    ctx.ellipse(rk.cx - rk.r * 0.25, y - rk.r * 0.3, rk.r * 0.45, rk.r * 0.28, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.rockDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    rk.verts.forEach((v, i) => { if (i === 0) ctx.moveTo(v.x, v.y - g.camY); else ctx.lineTo(v.x, v.y - g.camY); });
    ctx.closePath(); ctx.stroke();
  }
}

function drawPickups(ctx, g, now) {
  const pulse = (ph) => 0.75 + 0.25 * Math.sin(now / 450 + ph);
  for (const w of g.world.waters) {
    if (w.taken) continue;
    const y = w.y - g.camY;
    if (y < -60 || y > VIEW_H + 60) continue;
    if (g.rainSense) {
      ctx.fillStyle = 'rgba(140, 210, 255, 0.20)';
      ctx.fillRect(w.x - 4, 0, 8, y);
    }
    const grad = ctx.createRadialGradient(w.x, y, 2, w.x, y, w.r + 8 * pulse(w.phase));
    grad.addColorStop(0, PALETTE.waterCore);
    grad.addColorStop(0.5, PALETTE.waterRing);
    grad.addColorStop(1, 'rgba(43, 127, 184, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(w.x, y, w.r + 8 * pulse(w.phase), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(w.x - w.r * 0.3, y - w.r * 0.3, w.r * 0.28, 0, Math.PI * 2); ctx.fill();
  }
  for (const d of g.world.dews) {
    if (d.taken) continue;
    const y = d.y - g.camY;
    if (y < -20 || y > VIEW_H + 20) continue;
    ctx.fillStyle = PALETTE.waterRing;
    ctx.globalAlpha = 0.85 * pulse(d.phase);
    ctx.beginPath(); ctx.arc(d.x, y, d.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const n of g.world.nutrients) {
    if (n.taken) continue;
    const y = n.y - g.camY;
    if (y < -20 || y > VIEW_H + 20) continue;
    const rot = now / 900 + n.phase;
    ctx.save();
    ctx.translate(n.x, y); ctx.rotate(rot);
    ctx.fillStyle = PALETTE.nutrient;
    ctx.beginPath(); ctx.moveTo(0, -n.r); ctx.lineTo(n.r * 0.7, 0); ctx.lineTo(0, n.r); ctx.lineTo(-n.r * 0.7, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PALETTE.nutrientCore;
    ctx.beginPath(); ctx.moveTo(0, -n.r * 0.45); ctx.lineTo(n.r * 0.32, 0); ctx.lineTo(0, n.r * 0.45); ctx.lineTo(-n.r * 0.32, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawGrubs(ctx, g, now) {
  for (const grub of g.world.grubs) {
    const root = g.roots.roots.find((r) => r.id === grub.rootId);
    if (!root || !root.alive) continue;
    const p = g.roots.pointAt(root, grub.dist);
    const y = p.y - g.camY;
    if (y < -30 || y > VIEW_H + 30) continue;
    const wig = Math.sin(now / 120 + grub.wiggle) * 2;
    ctx.fillStyle = PALETTE.grubBody;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(p.x - i * 7, y + wig * (i % 2 === 0 ? 1 : -1), 8 - i * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = PALETTE.grubHead;
    ctx.beginPath(); ctx.arc(p.x + 9, y, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(122, 74, 82, 0.8)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(p.x - i * 7, y + 6); ctx.lineTo(p.x - i * 7 - 2, y + 11); ctx.stroke();
    }
    // Click target ring so the player sees grubs are clickable.
    ctx.strokeStyle = 'rgba(255, 122, 92, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, y, 17 + Math.sin(now / 300) * 2, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawRoots(ctx, g, now) {
  const withered = g.state === 'lost';
  for (const root of g.roots.roots) {
    if (root.points.length < 2) continue;
    const isActive = root.id === g.roots.activeId && g.state === 'playing';
    // Wide amber underlay first, so the root reads at a glance even shrunk.
    if (!withered) {
      ctx.strokeStyle = 'rgba(232, 185, 106, 0.16)';
      ctx.lineWidth = 13;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      root.points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y - g.camY); else ctx.lineTo(p.x, p.y - g.camY); });
      ctx.stroke();
    }
    for (let i = 1; i < root.points.length; i++) {
      const a = root.points[i - 1], b = root.points[i];
      const t = i / root.points.length;
      const w = 4 + (1 - t) * 7;
      // Dark outline, then the bright core: a root that reads as a root.
      ctx.strokeStyle = withered ? PALETTE.rootWithered : 'rgba(58, 32, 12, 0.9)';
      ctx.lineWidth = w + 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y - g.camY); ctx.lineTo(b.x, b.y - g.camY); ctx.stroke();
      ctx.strokeStyle = withered ? '#7d7268'
        : (i === root.points.length - 1 ? PALETTE.rootTip : (t < 0.4 ? PALETTE.rootBase : PALETTE.rootMid));
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - g.camY); ctx.lineTo(b.x, b.y - g.camY); ctx.stroke();
      // Root hairs every few segments.
      if (i % 3 === 0 && !withered) {
        ctx.strokeStyle = 'rgba(181, 126, 66, 0.5)';
        ctx.lineWidth = 1.2;
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        ctx.beginPath(); ctx.moveTo(b.x, b.y - g.camY); ctx.lineTo(b.x + nx * 7, b.y - g.camY + ny * 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(b.x, b.y - g.camY); ctx.lineTo(b.x - nx * 7, b.y - g.camY - ny * 7); ctx.stroke();
      }
    }
    // Active tip glows and pulses.
    if (isActive) {
      const tip = g.roots.tipOf(root);
      const pulse = 6 + Math.sin(now / 260) * 2;
      ctx.fillStyle = 'rgba(232, 185, 106, 0.9)';
      ctx.beginPath(); ctx.arc(tip.x, tip.y - g.camY, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255, 240, 200, 0.95)';
      ctx.beginPath(); ctx.arc(tip.x, tip.y - g.camY, 3, 0, Math.PI * 2); ctx.fill();
      text(ctx, '▼ ACTIVE TIP', tip.x, tip.y - g.camY - 18, 11, '#ffe9b0', 'center', 800);
    } else if (g.state === 'playing') {
      const tip = g.roots.tipOf(root);
      ctx.fillStyle = 'rgba(232, 185, 106, 0.45)';
      ctx.beginPath(); ctx.arc(tip.x, tip.y - g.camY, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---------------------------------------------------------------- HUD

function drawHUD(ctx, g) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = PALETTE.hudLine;
  ctx.fillRect(0, HUD_H, VIEW_W, 1);

  const depthM = Math.floor(g.maxDepthPx / PX_PER_M);
  text(ctx, 'DEPTH', 18, 18, 11, PALETTE.textDim, 'left', 800);
  text(ctx, `${depthM} m`, 18, 42, 24, PALETTE.text, 'left', 800);
  text(ctx, `/ ${WIN_DEPTH_M} m`, 108, 44, 13, PALETTE.textDim, 'left', 700);
  // Depth progress bar
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, 190, 22, 150, 10, 5); ctx.fill();
  ctx.fillStyle = PALETTE.accent;
  roundRect(ctx, 190, 22, Math.max(6, 150 * (depthM / WIN_DEPTH_M)), 10, 5); ctx.fill();

  // Energy bar
  text(ctx, 'ENERGY', 370, 18, 11, PALETTE.textDim, 'left', 800);
  const eFrac = Math.max(0, g.energy / g.energyMax);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, 370, 28, 170, 18, 9); ctx.fill();
  ctx.fillStyle = eFrac > 0.5 ? '#7ec850' : eFrac > 0.25 ? '#ffc94d' : PALETTE.danger;
  if (eFrac > 0) { roundRect(ctx, 370, 28, Math.max(8, 170 * eFrac), 18, 9); ctx.fill(); }
  text(ctx, `${Math.ceil(g.energy)} / ${g.energyMax}`, 455, 37, 12, '#fff', 'center', 800);

  text(ctx, `💧 ${g.waterCollected}`, 575, 32, 20, '#9fdcff', 'left', 800);
  text(ctx, `◆ ${g.nutrientsCollected}`, 660, 32, 20, PALETTE.nutrient, 'left', 800);
  text(ctx, `SCORE ${g.score.toLocaleString('en-US')}`, 780, 32, 20, PALETTE.text, 'left', 800);
  const layer = layerAt(g.maxDepthPx);
  text(ctx, `${layer.name}  ·  ${fmtTime(g.elapsedSec)}  ·  ${g.roots.aliveCount} ROOT${g.roots.aliveCount === 1 ? '' : 'S'}`, 780, 52, 12, PALETTE.textDim, 'left', 700);

  button(ctx, g, 'branch', 1050, 12, 92, 40, `BRANCH ${Math.ceil(g.branchCost)} ⏎`, { size: 14 });
  button(ctx, g, 'pause', 1150, 12, 52, 40, '❚❚', { size: 15 });
  button(ctx, g, 'mute', 1210, 12, 52, 40, g.audio.muted ? '🔇' : '🔊', { size: 15 });

  // Bottom hint line, contextual.
  const hint = g.state === 'playing'
    ? (g.roots.aliveCount > 1
      ? 'Hold mouse to grow the glowing tip toward water  ·  SPACE branch  ·  click a grub to squash it  ·  click a root tip to switch to it'
      : 'Hold mouse to grow toward water  ·  SPACE branch (12 energy)  ·  click grubs to squash them  ·  P pause')
    : '';
  if (hint) {
    ctx.fillStyle = 'rgba(12, 10, 8, 0.55)';
    ctx.fillRect(0, VIEW_H - 26, VIEW_W, 26);
    text(ctx, hint, VIEW_W / 2, VIEW_H - 12, 13, PALETTE.textDim, 'center', 600);
  }
}

// ---------------------------------------------------------------- overlays

function dim(ctx) {
  ctx.fillStyle = 'rgba(8, 6, 5, 0.62)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panelBg;
  roundRect(ctx, x, y, w, h, 16); ctx.fill();
  ctx.strokeStyle = PALETTE.panelLine;
  ctx.lineWidth = 2; ctx.stroke();
}

function drawTitle(ctx, g) {
  dim(ctx);
  panel(ctx, 290, 92, 700, 536);
  text(ctx, 'D E E P R O O T', 640, 168, 54, PALETTE.accent, 'center', 900);
  text(ctx, 'Grow the last seed to the Deep Spring', 640, 212, 20, PALETTE.text, 'center', 600);
  const lines = [
    ['HOLD MOUSE', '— the glowing tip grows toward your cursor. Water is fuel.'],
    ['WATER 💧', '— drink to refill energy. Dew sips a little, pools a lot.'],
    ['ROCKS', '— steer around them; they block the tip and cost energy.'],
    ['GRUBS', '— they crawl up roots and eat them. Click a grub to squash it.'],
    ['BRANCH  [SPACE]', '— split the tip to chase two pockets at once.'],
    ['BOONS', '— every 100 m, pick one upgrade. Then go deeper.'],
  ];
  let y = 258;
  for (const [a, b] of lines) {
    text(ctx, a, 340, y, 16, '#ffd970', 'left', 800);
    text(ctx, b, 340 + ctx.measureText(a).width + 90, y, 15, PALETTE.text, 'left', 600);
    y += 30;
  }
  text(ctx, 'Reach the Deep Spring at 500 m before your energy runs dry.', 640, y + 12, 16, PALETTE.textDim, 'center', 700);
  button(ctx, g, 'start', 490, 516, 300, 56, '▶  START GROWING', { accent: true, size: 22 });
  text(ctx, 'Best depth this session: ' + (g.bestDepthM > 0 ? `${g.bestDepthM} m` : '—'), 640, 600, 13, PALETTE.textDim, 'center', 600);
}

function drawPause(ctx, g) {
  dim(ctx);
  panel(ctx, 440, 220, 400, 280);
  text(ctx, 'PAUSED', 640, 272, 36, PALETTE.text, 'center', 900);
  text(ctx, `Depth ${Math.floor(g.maxDepthPx / PX_PER_M)} m  ·  Score ${g.score.toLocaleString('en-US')}`, 640, 316, 15, PALETTE.textDim, 'center', 600);
  button(ctx, g, 'resume', 520, 348, 240, 48, '▶  RESUME', { accent: true, size: 18 });
  button(ctx, g, 'restart', 520, 408, 240, 48, '↻  RESTART', { size: 18 });
  button(ctx, g, 'mute2', 520, 462, 240, 40, g.audio.muted ? '🔇  UNMUTE' : '🔊  MUTE', { size: 15 });
}

function drawBoon(ctx, g) {
  dim(ctx);
  panel(ctx, 190, 150, 900, 420);
  text(ctx, `100 m DEEPER — CHOOSE A BOON`, 640, 206, 30, PALETTE.accent, 'center', 900);
  text(ctx, `You crossed into ${layerAt(g.maxDepthPx).name}. One upgrade, then keep growing.`, 640, 240, 16, PALETTE.textDim, 'center', 600);
  const cards = g.boonChoices;
  const cw = 260, gap = 30;
  const x0 = 640 - (cards.length * cw + (cards.length - 1) * gap) / 2;
  cards.forEach((b, i) => {
    const x = x0 + i * (cw + gap);
    const id = `boon${i}`;
    const hover = g.hoverId === id;
    ctx.fillStyle = hover ? '#3d2c17' : '#241a10';
    roundRect(ctx, x, 280, cw, 220, 14); ctx.fill();
    ctx.strokeStyle = hover ? PALETTE.accent : PALETTE.panelLine;
    ctx.lineWidth = hover ? 3 : 2; ctx.stroke();
    const icons = { flask: '⚗', sap: '≋', bane: '☠', sense: '◉', stone: '⬢', twin: '⑂' };
    text(ctx, icons[b.icon] || '✦', x + cw / 2, 330, 44, PALETTE.accent, 'center', 700);
    text(ctx, b.name, x + cw / 2, 372, 18, PALETTE.text, 'center', 800);
    const words = wrapText(ctx, b.desc, cw - 36, 15);
    let wy = 402;
    for (const line of words) { text(ctx, line, x + cw / 2, wy, 15, PALETTE.textDim, 'center', 600); wy += 20; }
    text(ctx, `[ ${i + 1} ]`, x + cw / 2, 472, 14, PALETTE.textDim, 'center', 700);
    g.buttons.push({ id, x, y: 280, w: cw, h: 220 });
  });
}

function wrapText(ctx, s, maxW, size) {
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function statsLines(g) {
  const depthM = Math.floor(g.maxDepthPx / PX_PER_M);
  return [
    ['Depth reached', `${depthM} m / ${WIN_DEPTH_M} m`],
    ['Water drunk', `${g.waterCollected} pools · ${g.dewCollected} dew`],
    ['Nutrients', `${g.nutrientsCollected}  ·  Grubs squashed ${g.grubsSquashed}`],
    ['Roots grown', `${g.roots.roots.length}  ·  Time ${fmtTime(g.elapsedSec)}`],
    ['SCORE', `${g.score.toLocaleString('en-US')}`],
  ];
}

function drawEnd(ctx, g, won) {
  dim(ctx);
  panel(ctx, 390, 130, 500, 460);
  text(ctx, won ? 'THE SPRING BLOOMS' : 'THE ROOTS WITHER', 640, 196, 34, won ? '#9fdcff' : PALETTE.danger, 'center', 900);
  text(ctx, won ? 'The last seed drank from the Deep Spring.' : 'Out of energy, far from water. The soil keeps the seed.',
    640, 232, 15, PALETTE.textDim, 'center', 600);
  let y = 282;
  for (const [k, v] of statsLines(g)) {
    const big = k === 'SCORE';
    text(ctx, k, 440, y, big ? 18 : 15, big ? PALETTE.accent : PALETTE.textDim, 'left', big ? 900 : 700);
    text(ctx, v, 840, y, big ? 20 : 16, PALETTE.text, 'right', big ? 900 : 700);
    y += big ? 44 : 32;
  }
  if (won && g.timeBonus > 0) text(ctx, `Time bonus +${g.timeBonus.toLocaleString('en-US')}`, 640, y - 6, 14, '#7ec850', 'center', 700);
  button(ctx, g, 'restart', 490, 512, 300, 56, won ? '↻  GROW AGAIN' : '↻  TRY AGAIN', { accent: true, size: 20 });
}

// ---------------------------------------------------------------- main entry

export function render(ctx, g, now) {
  g.buttons.length = 0;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (g.state === 'title') {
    // Title shows the top of the world: sky, surface, the seed.
    drawSoil(ctx, g, now);
    drawPlant(ctx, g);
    drawRoots(ctx, g, now);
    drawHUD(ctx, g);
    drawTitle(ctx, g);
    return;
  }
  drawSoil(ctx, g, now);
  drawSpring(ctx, g, now);
  drawRocks(ctx, g);
  drawPickups(ctx, g, now);
  drawRoots(ctx, g, now);
  drawGrubs(ctx, g, now);
  drawPlant(ctx, g);
  drawHUD(ctx, g);
  if (g.state === 'paused') drawPause(ctx, g);
  else if (g.state === 'boon') drawBoon(ctx, g);
  else if (g.state === 'won') drawEnd(ctx, g, true);
  else if (g.state === 'lost') drawEnd(ctx, g, false);
}

export function pointInButton(g, x, y) {
  for (const b of g.buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

export { fmtTime, layerIndexAt };
