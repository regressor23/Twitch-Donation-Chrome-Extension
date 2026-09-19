/**
 * Fallback sweep (CLAUDE.md §10): Helius is allowed to miss.
 *
 * The address walked is the recipient's **associated token account**, not their
 * wallet. A `tip_direct` transaction names the donor, the two token accounts
 * and the mint — the streamer's wallet is nowhere in the account list, so
 * polling it would return nothing and look like everything was fine.
 *
 * This lives apart from the route because it has two callers: the in-process
 * timer in `instrumentation.ts`, which is the real fallback, and the HTTP
 * endpoint, which exists so a sweep can be forced during a test.
 */
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { eq, inArray } from 'drizzle-orm';

import { db } from './db/client';
import { channels, tips } from './db/schema';
import { env } from './env';
import { ingestSignature } from './ingest';
import { rpc } from './solana';

/** How far back a single sweep looks. Cheap, and 30 s apart it cannot fall behind. */
const SIGNATURE_LIMIT = 25;

export interface SweepResult {
  channels: number;
  scanned: number;
  picked: string[];
}

export async function sweep(): Promise<SweepResult> {
  const mint = new PublicKey(env().USDC_MINT);
  const watched = await db()
    .select({ channelId: channels.channelId, recipient: channels.recipient })
    .from(channels)
    .where(eq(channels.active, true));

  const picked: string[] = [];
  let scanned = 0;

  for (const channel of watched) {
    const ata = getAssociatedTokenAddressSync(mint, new PublicKey(channel.recipient), true);
    const signatures = await rpc().getSignaturesForAddress(ata, { limit: SIGNATURE_LIMIT });
    scanned += signatures.length;
    if (signatures.length === 0) {
      continue;
    }

    // One query instead of one per signature: the sweep runs every 30 seconds
    // and almost always finds nothing new.
    const all = signatures.map((entry) => entry.signature);
    const known = await db()
      .select({ signature: tips.signature })
      .from(tips)
      .where(inArray(tips.signature, all));
    const seen = new Set(known.map((row) => row.signature));

    for (const entry of signatures) {
      if (seen.has(entry.signature) || entry.err) {
        continue;
      }
      const outcome = await ingestSignature(entry.signature, {
        source: 'poll',
        channelHint: channel.channelId,
      });
      console.log(`[poll] ${entry.signature} -> ${outcome.kind}`);
      if (outcome.kind === 'alert' || outcome.kind === 'recorded-silent') {
        picked.push(entry.signature);
      }
    }
  }

  return { channels: watched.length, scanned, picked };
}
