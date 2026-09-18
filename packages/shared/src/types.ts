/**
 * Shared domain and wire types.
 *
 * Money is never a float (CLAUDE.md 4.4). Inside the app amounts are `bigint`
 * minor units; on the wire they are decimal strings, because `JSON.stringify`
 * throws on a bigint and the usual "fix" for that is exactly the `Number()`
 * call that loses cents.
 */

/** A u64 amount in minor units, serialised for JSON. Example: `'2000000'`. */
export type U64String = string;

/** Lifecycle of a tip row (CLAUDE.md 5.4). */
export type TipStatus = 'seen' | 'confirmed' | 'alerted';

/** Direct transfer to the streamer's wallet, or escrow PDA for unclaimed channels. */
export type TipMode = 'direct' | 'escrow';

export type Cluster = 'mainnet-beta' | 'devnet';

/** One tip as stored by the indexer. No donor PII is kept (CLAUDE.md 5.4). */
export interface Tip {
  /** Transaction signature; unique key, webhook handling is idempotent on it. */
  signature: string;
  channelId: string;
  /** Minor units of `mint`. */
  amount: bigint;
  mint: string;
  nick: string;
  message: string;
  status: TipStatus;
  slot: number;
  /** ISO-8601 timestamps. */
  seenAt: string;
  confirmedAt: string | null;
  alertedAt: string | null;
}

export interface Channel {
  channelId: string;
  /** Twitch login, lowercase, as it appears in the channel URL. */
  login: string;
  displayName: string;
  /** Owner wallet for `direct`, escrow PDA for `escrow`. */
  recipient: string;
  mode: TipMode;
  mint: string;
  minTip: bigint;
  presets: readonly bigint[];
}

/** `GET /api/channel/[login]/resolve` (CLAUDE.md 5.3). */
export interface ResolveResponse {
  channelId: string;
  recipient: string;
  mode: TipMode;
  presets: readonly U64String[];
  minTip: U64String;
  mint: string;
}

/** One alert pushed to the overlay over SSE. */
export interface AlertEvent {
  /** Stable id for de-duplication across reconnects. */
  id: string;
  channelId: string;
  signature: string;
  nick: string;
  message: string;
  amount: U64String;
  mint: string;
  createdAt: string;
}

const U64_STRING_RE = /^(0|[1-9][0-9]*)$/;
const U64_MAX = 18_446_744_073_709_551_615n;

/** @throws {RangeError} on a negative value or one that does not fit in a u64. */
export function toU64String(value: bigint): U64String {
  if (value < 0n || value > U64_MAX) {
    throw new RangeError(`amount out of u64 range: ${value}`);
  }
  return value.toString(10);
}

/** @throws {TypeError} on anything that is not a canonical u64 decimal string. */
export function fromU64String(value: U64String): bigint {
  if (!U64_STRING_RE.test(value)) {
    throw new TypeError(`not a u64 decimal string: ${JSON.stringify(value)}`);
  }
  const parsed = BigInt(value);
  if (parsed > U64_MAX) {
    throw new RangeError(`amount out of u64 range: ${value}`);
  }
  return parsed;
}
