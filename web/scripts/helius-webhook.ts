/**
 * Registers, updates, lists or removes the Helius transaction webhook.
 *
 * Helius has no request signing: the only authentication it offers is a static
 * value echoed in the `Authorization` header. That value is
 * `HELIUS_WEBHOOK_SECRET` from `.env.local`, and it is pushed from here so the
 * two sides cannot drift. It is never printed.
 *
 * The addresses watched are **token accounts**, not wallets. A `tip_direct`
 * transaction names the donor, the two token accounts and the mint — the
 * streamer's wallet is not among them, so watching it would see nothing.
 *
 *   pnpm --filter @tipvault/web helius:webhook -- --list
 *   pnpm --filter @tipvault/web helius:webhook -- --url https://<host>
 *   pnpm --filter @tipvault/web helius:webhook -- --delete <id>
 */
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

import { loadLocalEnv } from '../lib/env';

loadLocalEnv();

/**
 * Helius keys webhooks by network through the API host, not through a field in
 * the body: `api.helius.xyz` registers a mainnet webhook and `api-devnet` a
 * devnet one. Register on the wrong host and everything reports success while
 * nothing ever fires.
 */
function apiBase(): string {
  const devnet = (process.env.RPC_URL_PRIVATE ?? '').includes('devnet');
  return devnet
    ? 'https://api-devnet.helius.xyz/v0/webhooks'
    : 'https://api.helius.xyz/v0/webhooks';
}

interface Webhook {
  webhookID: string;
  webhookURL: string;
  accountAddresses: string[];
  transactionTypes: string[];
  webhookType?: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing from web/.env.local`);
  }
  return value;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const key = required('HELIUS_API_KEY');
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${apiBase()}${path}${separator}api-key=${key}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`helius ${response.status}: ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

/** Every address a tip can touch: both token accounts, plus the wallet itself. */
function watchedAddresses(): string[] {
  const streamer = new PublicKey(required('TEST_STREAMER'));
  const addresses = [streamer.toBase58()];
  for (const name of ['USDC_MINT', 'TEST_SCAM_MINT']) {
    const mint = process.env[name];
    if (mint) {
      addresses.push(getAssociatedTokenAddressSync(new PublicKey(mint), streamer).toBase58());
    }
  }
  return [...new Set(addresses)];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | null => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? (argv[index + 1] ?? '') : null;
  };

  if (argv.includes('--list')) {
    const hooks = await call<Webhook[]>('');
    for (const hook of hooks) {
      console.log(`${hook.webhookID}  ${hook.webhookURL}`);
      console.log(`  addresses: ${hook.accountAddresses.join(', ')}`);
    }
    if (hooks.length === 0) {
      console.log('(no webhooks)');
    }
    return;
  }

  const toDelete = flag('delete');
  if (toDelete) {
    await call(`/${toDelete}`, { method: 'DELETE' });
    console.log(`deleted ${toDelete}`);
    return;
  }

  const base = flag('url');
  if (!base) {
    throw new Error('pass --url https://<host> (no trailing slash)');
  }

  const body = {
    webhookURL: `${base.replace(/\/$/, '')}/api/webhooks/helius`,
    transactionTypes: ['Any'],
    accountAddresses: watchedAddresses(),
    // The network lives in the type, not in a separate field: `raw` is mainnet
    // and `rawDevnet` is devnet. Get it wrong and Helius accepts the webhook,
    // reports it as active, and never calls.
    webhookType: (process.env.RPC_URL_PRIVATE ?? '').includes('devnet') ? 'rawDevnet' : 'raw',
    authHeader: required('HELIUS_WEBHOOK_SECRET'),
  };

  // One webhook on the free plan: reuse the existing one instead of failing.
  const existing = await call<Webhook[]>('');
  const hook = existing[0]
    ? await call<Webhook>(`/${existing[0].webhookID}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    : await call<Webhook>('', { method: 'POST', body: JSON.stringify(body) });

  console.log(`${existing[0] ? 'updated' : 'created'} ${hook.webhookID}`);
  console.log(`  url:       ${hook.webhookURL}`);
  console.log(`  addresses: ${hook.accountAddresses.join('\n             ')}`);
  console.log('  authHeader: set from HELIUS_WEBHOOK_SECRET (not shown)');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
