/**
 * One-off devnet setup for S3.
 *
 * Circle's faucet refuses us at the WAF, so the "USDC" here is our own mint with
 * the same six decimals, pinned in `USDC_MINT`. That is exactly what the env var
 * exists for (§5.5: "devnet vs mainnet differ"), and it costs the mint filter
 * nothing: the indexer compares against the configured mint, never a constant
 * baked into the code. `packages/shared` still carries Circle's address and is
 * not touched.
 *
 * The second mint is the scam token for the filter test — same decimals, same
 * everything, wrong address.
 *
 *   pnpm --filter @tipvault/web devnet:setup
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { createMint, getMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

import { loadLocalEnv } from '../lib/env';

loadLocalEnv();

const DECIMALS = 6;
const ONE = 1_000_000n;

function keypairFrom(path: string): Keypair {
  const bytes = Uint8Array.from(JSON.parse(readFileSync(path, 'utf8')) as number[]);
  return Keypair.fromSecretKey(bytes);
}

function loadOrCreate(path: string): Keypair {
  try {
    return keypairFrom(path);
  } catch {
    const keypair = Keypair.generate();
    writeFileSync(path, JSON.stringify([...keypair.secretKey]), { mode: 0o600 });
    console.log(`generated ${path}`);
    return keypair;
  }
}

async function main(): Promise<void> {
  const rpcUrl = process.env.RPC_URL_PRIVATE;
  if (!rpcUrl) {
    throw new Error('RPC_URL_PRIVATE is missing from web/.env.local');
  }
  const connection = new Connection(rpcUrl, 'confirmed');

  const payer = keypairFrom(join(homedir(), '.config', 'solana', 'id.json'));
  const streamer = loadOrCreate(join(homedir(), '.config', 'solana', 'tipvault-streamer.json'));

  const balance = await connection.getBalance(payer.publicKey);
  console.log(
    `payer    ${payer.publicKey.toBase58()}  ${(balance / LAMPORTS_PER_SOL).toFixed(3)} SOL`,
  );
  console.log(`streamer ${streamer.publicKey.toBase58()}`);
  if (balance < 0.2 * LAMPORTS_PER_SOL) {
    throw new Error('payer is too low on SOL for mint and account rent');
  }

  /**
   * Reuse a mint across runs, but only one we can actually mint from.
   *
   * `USDC_MINT` starts out holding Circle's devnet address, which exists on
   * chain and is emphatically not ours — reusing it on "the account exists"
   * alone ends in `owner does not match` from the token program.
   */
  async function ours(address: string | undefined): Promise<PublicKey | null> {
    if (!address) {
      return null;
    }
    try {
      const mint = await getMint(connection, new PublicKey(address));
      return mint.mintAuthority?.equals(payer.publicKey) ? mint.address : null;
    } catch {
      return null;
    }
  }

  const usdc =
    (await ours(process.env.USDC_MINT)) ??
    (await createMint(connection, payer, payer.publicKey, null, DECIMALS));
  const scam =
    (await ours(process.env.TEST_SCAM_MINT)) ??
    (await createMint(connection, payer, payer.publicKey, null, DECIMALS));

  console.log(`usdc-like mint ${usdc.toBase58()}`);
  console.log(`scam mint      ${scam.toBase58()}`);

  for (const mint of [usdc, scam]) {
    // The donor needs a funded account; the streamer needs an account to exist,
    // because `tip_direct` transfers into it and does not create it.
    const donorAta = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      payer.publicKey,
    );
    const streamerAta = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      streamer.publicKey,
    );
    if (donorAta.amount < 100n * ONE) {
      await mintTo(connection, payer, mint, donorAta.address, payer, 1_000n * ONE);
    }
    console.log(
      `  ${mint.toBase58().slice(0, 8)}…  donor ata ${donorAta.address.toBase58()}  streamer ata ${streamerAta.address.toBase58()}`,
    );
  }

  const file = '.env.local';
  let body = readFileSync(file, 'utf8');
  const set = (name: string, value: string): void => {
    body = body.match(new RegExp(`^${name}=`, 'm'))
      ? body.replace(new RegExp(`^${name}=.*$`, 'm'), `${name}=${value}`)
      : `${body}${name}=${value}\n`;
  };
  set('USDC_MINT', usdc.toBase58());
  set('TEST_SCAM_MINT', scam.toBase58());
  set('TEST_STREAMER', streamer.publicKey.toBase58());
  writeFileSync(file, body, { mode: 0o600 });
  console.log('\nupdated .env.local: USDC_MINT, TEST_SCAM_MINT, TEST_STREAMER');
}

// Not top-level await: web/ is not `"type": "module"`, so tsx transpiles these
// scripts to CJS and top-level await is a syntax error there.
main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
