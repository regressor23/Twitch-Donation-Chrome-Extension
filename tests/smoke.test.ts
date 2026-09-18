import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Workspace directory -> expected package name (pnpm-workspace.yaml). */
const workspacePackages: ReadonlyArray<readonly [string, string]> = [
  ['packages/shared', '@tipvault/shared'],
  ['web', '@tipvault/web'],
  ['ext', '@tipvault/ext'],
  ['program', '@tipvault/program'],
];

/** Every variable required by CLAUDE.md section 5.5, in declaration order. */
const requiredEnvKeys = [
  'RPC_URL_PRIVATE',
  'NEXT_PUBLIC_RPC_URL',
  'HELIUS_API_KEY',
  'HELIUS_WEBHOOK_SECRET',
  'USDC_MINT',
  'AUTHORITY_SECRET',
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE',
  'CABINA_MCP_URL',
  'CABINA_MCP_TOKEN',
  'MERCURYO_WIDGET_ID',
];

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8')) as Record<string, unknown>;
}

describe('monorepo skeleton', () => {
  it.each(workspacePackages)('%s is a workspace package named %s', (dir, expectedName) => {
    expect(readJson(join(dir, 'package.json')).name).toBe(expectedName);
  });

  it('.env.example lists every variable from CLAUDE.md 5.5', () => {
    const declared = readFileSync(join(repoRoot, '.env.example'), 'utf8')
      .split('\n')
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => line.slice(0, line.indexOf('=')));

    expect(declared).toEqual(requiredEnvKeys);
  });

  it('never ships a real .env file to git', () => {
    const ignored = readFileSync(join(repoRoot, '.gitignore'), 'utf8');
    expect(ignored).toMatch(/^\.env$/m);
    expect(ignored).toMatch(/^!\.env\.example$/m);
  });

  it('keeps the MV3 manifest at the minimum permission set', () => {
    const manifest = readJson('ext/public/manifest.json');
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.host_permissions).toEqual(['https://*.twitch.tv/*']);
  });
});
