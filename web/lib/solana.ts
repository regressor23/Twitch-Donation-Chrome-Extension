/**
 * RPC access. One connection per process, and one place that knows how to wait
 * for a transaction the node has not caught up with yet.
 */
import { Connection, type ParsedTransactionWithMeta } from '@solana/web3.js';

import { env, loadLocalEnv } from './env';

const holder = globalThis as unknown as { __tipvaultRpc?: Connection };

export function rpc(): Connection {
  if (!holder.__tipvaultRpc) {
    loadLocalEnv();
    holder.__tipvaultRpc = new Connection(env().RPC_URL_PRIVATE, 'confirmed');
  }
  return holder.__tipvaultRpc;
}

/**
 * Fetches a confirmed transaction, retrying while the node still returns null.
 *
 * A webhook can beat the RPC node it is read from: Helius sees the transaction
 * on its own infrastructure and calls us before the node we query has indexed
 * it. Treating that as "does not exist" would drop a real tip, so a short
 * backoff runs first and only then does the caller record it as `seen` for the
 * poller to pick up later.
 */
export async function fetchTransaction(
  signature: string,
  attempts = 4,
): Promise<ParsedTransactionWithMeta | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const parsed = await rpc().getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (parsed) {
      return parsed;
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
  return null;
}
