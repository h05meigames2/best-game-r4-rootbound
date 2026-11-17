// ROOTBOUND — the entry program (Node 22, standard library only).
//
// What it does: it hands the game in. It copies this repository's game/
// (the playable static files) and screenshots/ (the four staged renders)
// into the output directory and writes /output/dossier.json, the summary
// the judge reads, using the kit's vendored make.fun library.
//
// The grader runs this program twice in a fresh container with no network,
// a read-only copy of the repository and a writable /output; both runs must
// write the same bytes. Outside that container, MAKEFUN_OUTPUT_DIR stands
// in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory holding this file.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// The scorer's own caps, from the kit's reference/gate.json: the dossier
// text is capped at 160 KiB; screenshots at 4 files of 256 KiB each; game/
// at 993 files and directories together and 48 MiB in all, with no path
// over 1000 bytes. buildDossier enforces them and throws otherwise.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message) {
  throw new Error(`main.ts: ${message}`);
}

// Refuse to hand in a broken entry instead of writing a partial /output.
const gameDir = join(repoRoot, 'game');
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
const shotsDir = join(repoRoot, 'screenshots');
if (!existsSync(shotsDir)) fail('screenshots/ is missing');
const shots = readdirSync(shotsDir)
  .filter((name) => !name.startsWith('.'))
  .filter((name) => statSync(join(shotsDir, name)).isFile());
if (shots.length < 3 || shots.length > 4) fail(`expected 3 or 4 screenshots, found ${shots.length}`);
for (const name of shots) {
  if (statSync(join(shotsDir, name)).size > 262144) fail(`screenshot ${name} is over 256 KiB`);
}

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, dossierCaps);
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`ROOTBOUND handed in: ${shots.length} screenshots, dossier ${dossier.length} bytes -> ${outDir}`);
