/**
 * Network constants.
 *
 * Every address here was checked against the chain before being written down
 * (see docs/journal.md, S1): both mints are SPL Token mints with 6 decimals,
 * the mainnet one is Circle's verified USDC.
 */

import type { Cluster } from './types.js';

export const USDC_DECIMALS = 6;

export const USDC_MINT: Readonly<Record<Cluster, string>> = {
  // Circle USDC. getAccountInfo: SPL Token mint, decimals 6; Jupiter token API:
  // symbol USDC, name "USD Coin", verified.
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  // Circle USDC on devnet, per Circle's "USDC on testing networks" docs.
  // getAccountInfo on devnet: SPL Token mint, decimals 6.
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
};

/**
 * PLACEHOLDER — the Anchor template id, same as in `program/`. The real program
 * id is generated and deployed in S2 and replaces this constant then.
 */
export const TIP_VAULT_PROGRAM_ID = 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS';

/** $1.00 in USDC minor units — the on-chain `AmountTooSmall` floor (CLAUDE.md 5.2). */
export const MIN_TIP = 1_000_000n;

/** Amounts offered as one-click buttons: $2 / $5 / $20. */
export const TIP_PRESETS: readonly bigint[] = [2_000_000n, 5_000_000n, 20_000_000n];

export const DEFAULT_CLUSTER: Cluster = 'devnet';

/** Smallest representable amount: 0.000001 USDC. */
export const ONE_MINOR_UNIT = 1n;
