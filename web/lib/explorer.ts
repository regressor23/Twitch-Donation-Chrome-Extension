/**
 * Links to the block explorer.
 *
 * Which chain we are on is not a separate variable: §5.5 has no CLUSTER, and
 * adding one would create a second source of truth that can quietly disagree
 * with the mint the app actually watches. The mint already answers the
 * question — a deployment configured with Circle's mainnet USDC is on mainnet.
 */
import { USDC_MINT, type Cluster } from '@tipvault/shared';

import { env } from './env';

export function cluster(): Cluster {
  return env().USDC_MINT === USDC_MINT['mainnet-beta'] ? 'mainnet-beta' : 'devnet';
}

export function explorerTx(signature: string): string {
  const current = cluster();
  return current === 'mainnet-beta'
    ? `https://explorer.solana.com/tx/${signature}`
    : `https://explorer.solana.com/tx/${signature}?cluster=${current}`;
}
