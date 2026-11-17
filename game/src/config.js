// DEEPROOT — configuration: every tunable number of the game lives here.
// One job: constants, the five soil layers, the six boons, the palette.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 64;
export const PX_PER_M = 6; // 1 metre of depth = 6 px, so 500 m = 3000 px of soil
export const WORLD_W = 1280;
export const WORLD_DEPTH_PX = 500 * PX_PER_M;
export const SURFACE_Y = 0;
export const WIN_DEPTH_M = 500;
export const SEED_X = 640;
export const SEED_Y = 8;

// Energy economy: growing costs energy, water refills it, running dry ends the run.
export const ENERGY_START = 100;
export const ENERGY_MAX = 100;
export const WATER_ENERGY = 24;
export const DEW_ENERGY = 6;
export const NUTRIENT_ENERGY = 8;
export const BRANCH_COST = 12;
export const ROCK_BUMP_COST = 1;
export const GROW_SPEED = 150; // px per second, before boons
export const MAX_TIPS = 6;

// Scoring: depth is the backbone, everything else is a bonus on top.
export const SCORE_PER_M = 10;
export const SCORE_WATER = 15;
export const SCORE_NUTRIENT = 50;
export const SCORE_GRUB = 20;
export const WIN_TIME_BONUS = 1500;
export const WIN_TIME_BONUS_PER_SEC = 2;

export const LAYERS = [
  {
    name: 'TOPSOIL', range: '0–100 m', y0: 0, y1: 600,
    soilTop: '#4a3220', soilBottom: '#3a2718', speckle: '#5d4128',
    rocks: 7, water: 12, dew: 10, nutrients: 4,
    grubEverySec: 26, maxGrubs: 2, growthCost: 0.042, label: '#c9a06a',
  },
  {
    name: 'CLAY', range: '100–200 m', y0: 600, y1: 1200,
    soilTop: '#5b3a28', soilBottom: '#472c1e', speckle: '#6e4a32',
    rocks: 10, water: 11, dew: 9, nutrients: 4,
    grubEverySec: 21, maxGrubs: 3, growthCost: 0.046, label: '#d8a86e',
  },
  {
    name: 'GRAVEL', range: '200–300 m', y0: 1200, y1: 1800,
    soilTop: '#54432e', soilBottom: '#413522', speckle: '#6b5a3c',
    rocks: 13, water: 10, dew: 8, nutrients: 5,
    grubEverySec: 17, maxGrubs: 3, growthCost: 0.050, label: '#e0b47c',
  },
  {
    name: 'FLINT', range: '300–400 m', y0: 1800, y1: 2400,
    soilTop: '#463c38', soilBottom: '#362e2c', speckle: '#5a4e48',
    rocks: 16, water: 9, dew: 7, nutrients: 5,
    grubEverySec: 14, maxGrubs: 4, growthCost: 0.054, label: '#e8c088',
  },
  {
    name: 'DEEP DARK', range: '400–500 m', y0: 2400, y1: 3000,
    soilTop: '#2e2a33', soilBottom: '#221f26', speckle: '#413a48',
    rocks: 19, water: 9, dew: 6, nutrients: 6,
    grubEverySec: 11, maxGrubs: 5, growthCost: 0.058, label: '#f0cd95',
  },
];

export function layerAt(y) {
  for (const l of LAYERS) if (y >= l.y0 && y < l.y1) return l;
  return LAYERS[LAYERS.length - 1];
}
export function layerIndexAt(y) {
  for (let i = 0; i < LAYERS.length; i++) if (y >= LAYERS[i].y0 && y < LAYERS[i].y1) return i;
  return LAYERS.length - 1;
}

// Boons offered at every 100 m boundary. Pick one; the run bends around it.
export const BOONS = [
  {
    id: 'flask', name: 'DEEP FLASK', icon: 'flask',
    desc: '+40 max energy and +40 energy right now. Room to roam.',
    apply(g) { g.energyMax += 40; g.energy = Math.min(g.energyMax, g.energy + 40); },
  },
  {
    id: 'sap', name: 'SWIFT SAP', icon: 'sap',
    desc: 'Roots grow 25% faster. Cover ground before the grubs do.',
    apply(g) { g.growSpeedMul *= 1.25; },
  },
  {
    id: 'bane', name: 'GRUB BANE', icon: 'bane',
    desc: 'Sap turns bitter: any grub touching a root dies on contact.',
    apply(g) { g.grubBane = true; },
  },
  {
    id: 'sense', name: 'RAIN SENSE', icon: 'sense',
    desc: 'Water pockets shine with a beacon of light. Never miss a drink.',
    apply(g) { g.rainSense = true; },
  },
  {
    id: 'stone', name: 'STONE SOFTENER', icon: 'stone',
    desc: 'Push through the next 3 rocks instead of bouncing off them.',
    apply(g) { g.stoneSoftener += 3; },
  },
  {
    id: 'twin', name: 'TWIN SPROUT', icon: 'twin',
    desc: 'A free branch right now, and every later branch costs half.',
    apply(g) { g.branchCostMul *= 0.5; g.branchFree = true; },
  },
];

export const PALETTE = {
  skyTop: '#9fd8ef', skyBottom: '#e8f6df',
  rootBase: '#8a5a2b', rootMid: '#b57e42', rootTip: '#e8b96a',
  rootWithered: '#6e6258',
  waterCore: '#bfeaff', waterRing: '#5fb7e8', waterDeep: '#2b7fb8',
  nutrient: '#ffc94d', nutrientCore: '#fff3c4',
  grubBody: '#e8b7c4', grubHead: '#7a4a52', grubBelly: '#f6dfe4',
  rock: '#5c564e', rockLight: '#7d756a', rockDark: '#3c372f',
  springCore: '#cfeeff', springGlow: '#6fc4ef',
  hudBg: 'rgba(12, 10, 8, 0.72)', hudLine: 'rgba(255, 220, 160, 0.25)',
  text: '#f4e8d2', textDim: '#c9b18c', accent: '#ffc94d', danger: '#ff7a5c',
  panelBg: 'rgba(16, 12, 9, 0.92)', panelLine: '#8a6a42',
};
