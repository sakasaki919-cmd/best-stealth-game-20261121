// Operasi Bayang — make.fun hand-in program (Node 22, standard library only).
//
// When run, it copies this repository's game/ and screenshots/ into the
// output directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts, using the bounty's caps. The grader runs it twice
// in a fresh container with no network: /bot holds the repository read-only
// and /output is writable. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output, so `MAKEFUN_OUTPUT_DIR=out node main.ts` from the repo root
// writes the same bytes to ./out.
//
// The program is deterministic: copying plain files and building the dossier
// from them writes identical bytes on every run.

// The caps below are the bounty's own gate.json values: the dossier text is
// capped at 160 KiB, at most 4 screenshots of 256 KiB each, and game/ holds
// at most 993 entries / 48 MiB with paths of at most 1000 bytes. Passing the
// same caps here makes this program fail exactly where the scorer would,
// instead of handing in something the gate then refuses.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outputDir, 'dossier.json'), dossier);

// Sanity check: the dossier must name the game and hold its screenshots, so
// a silent empty hand-in is caught here instead of at the gate. (Decode with
// TextDecoder: Uint8Array.toString() would just join the byte values.)
const dossierText = new TextDecoder('utf-8').decode(dossier);
const dossierJson = JSON.parse(dossierText);
if (!dossierText.includes('game/index.html') || !Array.isArray(dossierJson.images) || dossierJson.images.length < 3) {
  throw new Error('dossier is missing the game or its screenshots');
}
console.log(`wrote ${join(outputDir, 'dossier.json')} (${dossier.length} bytes)`);
