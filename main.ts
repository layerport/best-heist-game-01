// main.ts — hands The Midnight Vault in to make.fun.
// Copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json with buildDossier from the kit's own
// vendor/makefun-game.ts (copied unchanged). Node 22 stdlib only.
// Run locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The grader runs it twice; both runs must write the same bytes.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The dossier caps are this competition's gate: 160 KiB of source text,
// at most 4 screenshots of at most 256 KiB each, game/ within 993 entries
// and 48 MiB, every game path within 1,000 UTF-8 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Copy one tree, directory by directory, so the output holds exactly what
// the repository holds — no extra files, no stale files from an older run.
function copyTreeIntoOutput(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outputDir, name);
  cpSync(from, to, { recursive: true });
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
copyTreeIntoOutput('game');
copyTreeIntoOutput('screenshots');

// buildDossier reads the game/ and screenshots/ just copied and returns the
// dossier as canonical JSON bytes; the scorer rebuilds it the same way and
// requires the two to match byte for byte.
const dossier = buildDossier(outputDir, DOSSIER_CAPS);
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`wrote ${join(outputDir, 'dossier.json')} (${dossier.length} bytes)`);
