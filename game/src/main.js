// ROOTBOUND — bootstrap: canvas, input, game loop, screenshot staging.
// One job: wire the modules together and run requestAnimationFrame.

import { VIEW_W, VIEW_H } from './config.js';
import { createInput } from './input.js';
import { createGame } from './game.js';
import { stageShot, stageBoon } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const input = createInput(canvas, {
  onPress() { /* press wakes audio via the key/pointer handlers in game */ },
  onKey(key) { game.handleKey(key); },
});
const game = createGame(canvas, input);

// Expose the game for debugging and for the screenshot/autopilot harness.
window.__rootbound = game;

if (shot === 'boon') {
  stageBoon(game);
} else if (shot) {
  stageShot(game, shot);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt, now);
  game.renderFrame(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
