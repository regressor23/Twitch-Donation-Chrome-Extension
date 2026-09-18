#!/usr/bin/env node
/**
 * Copies what `anchor build` leaves in target/ into the tracked idl/ and types/
 * folders.
 *
 * target/ is gitignored and CI has no Rust or Solana toolchain, so these copies
 * — not the build output — are what the tests and `pnpm typecheck` consume. A
 * fresh clone therefore resolves and type-checks without building the program.
 *
 * With `--check` it compares instead of writing and exits non-zero on drift, so
 * a stale copy cannot quietly outlive a change to the program.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  ['target/idl/tip_vault.json', 'idl/tip_vault.json'],
  ['target/types/tip_vault.ts', 'types/tip_vault.ts'],
  ['target/types/tip_vault_errors.ts', 'types/tip_vault_errors.ts'],
];

const check = process.argv.includes('--check');
let drift = 0;

for (const [from, to] of FILES) {
  const source = join(root, from);
  const target = join(root, to);

  if (!existsSync(source)) {
    console.error(`${from} is missing — run \`anchor build\` first`);
    process.exit(2);
  }

  const next = readFileSync(source, 'utf8');
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
  if (next === current) {
    continue;
  }

  if (check) {
    console.error(`out of date: ${to}`);
    drift += 1;
    continue;
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, next);
  console.log(`updated ${to}`);
}

if (check) {
  if (drift > 0) {
    console.error('run `pnpm --filter @tipvault/program sync:idl` and commit the result');
    process.exit(1);
  }
  console.log('idl and types match the build output');
}
