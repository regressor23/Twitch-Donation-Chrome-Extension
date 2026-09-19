/**
 * Sends a real tip on devnet through the deployed `tip_vault` program.
 *
 * This is the transaction the whole stage is judged on, so it goes through
 * `tip_direct` on chain — not a plain token transfer that happens to look like
 * one. The memo is built by the shared codec, the same one the extension will
 * use in S7.
 *
 *   pnpm --filter @tipvault/web devnet:tip -- --amount 2 --nick alex --message "gg"
 *   pnpm --filter @tipvault/web devnet:tip -- --scam        # wrong mint, valid memo
 *   pnpm --filter @tipvault/web devnet:tip -- --memo "hello from another protocol"
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { AnchorProvider, BN, Program, Wallet, type Idl } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { encodeMemo } from '@tipvault/shared';

import { loadLocalEnv } from '../lib/env';

loadLocalEnv();

interface Args {
  amount: number;
  nick: string;
  message: string;
  scam: boolean;
  memo: string | null;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | null => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };
  return {
    amount: Number(get('amount') ?? '2'),
    nick: get('nick') ?? 'alex',
    message: get('message') ?? 'gg wp',
    scam: argv.includes('--scam'),
    memo: get('memo'),
  };
}

function keypairFrom(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8')) as number[]));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const rpcUrl = process.env.RPC_URL_PRIVATE;
  const channelId = process.env.TEST_CHANNEL_ID ?? '123456789';
  const streamer = process.env.TEST_STREAMER;
  const mintAddress = args.scam ? process.env.TEST_SCAM_MINT : process.env.USDC_MINT;
  if (!rpcUrl || !streamer || !mintAddress) {
    throw new Error('run devnet:setup first');
  }

  const donor = keypairFrom(join(homedir(), '.config', 'solana', 'id.json'));
  const connection = new Connection(rpcUrl, 'confirmed');
  const provider = new AnchorProvider(connection, new Wallet(donor), { commitment: 'confirmed' });

  // The IDL is the copy tracked in program/idl, the one S2c pinned to the
  // deployed build; nothing here reads target/.
  const idl = JSON.parse(
    readFileSync(join(process.cwd(), '..', 'program', 'idl', 'tip_vault.json'), 'utf8'),
  ) as Idl;
  const program = new Program(idl, provider);

  const mint = new PublicKey(mintAddress);
  const recipient = new PublicKey(streamer);
  const memo = args.memo ?? encodeMemo({ channelId, nick: args.nick, message: args.message });
  const minorUnits = BigInt(Math.round(args.amount * 1_000_000));

  console.log(`mint    ${mint.toBase58()}${args.scam ? '  (scam token — must not alert)' : ''}`);
  console.log(`amount  ${minorUnits} minor units`);
  console.log(`memo    ${JSON.stringify(memo)}`);

  // The IDL is loaded at runtime, so the method map is untyped. Checking it
  // here turns "cannot read property of undefined" into a sentence.
  const tipDirect = program.methods.tipDirect;
  if (!tipDirect) {
    throw new Error('tip_direct is missing from program/idl/tip_vault.json');
  }

  const sentAt = Date.now();
  const signature = await tipDirect(new BN(minorUnits.toString()), memo)
    .accountsPartial({
      donor: donor.publicKey,
      donorToken: getAssociatedTokenAddressSync(mint, donor.publicKey),
      recipientToken: getAssociatedTokenAddressSync(mint, recipient),
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc({ commitment: 'confirmed' });
  const confirmedAt = Date.now();

  console.log(`\nsignature ${signature}`);
  console.log(`explorer  https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  console.log(`confirmed in ${confirmedAt - sentAt} ms`);
  // Machine-readable line for the latency harness. Both instants matter:
  // `SENT_AT` is when the signed transaction left this process, which is the
  // "from the signature" the acceptance condition asks about, and
  // `CONFIRMED_AT` is when our own RPC round trip admitted it had landed.
  console.log(`SENT_AT=${sentAt} CONFIRMED_AT=${confirmedAt} SIGNATURE=${signature}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
