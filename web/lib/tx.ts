/**
 * Turning a confirmed transaction into a tip — or into a deliberate refusal.
 *
 * Everything here is pure so it can be tested without a validator: the webhook
 * and the fallback poller both feed it the same `getParsedTransaction` result.
 * Neither trigger is trusted with anything beyond a signature (§4.6): what the
 * payload from Helius claims about an amount or a mint never reaches this file.
 *
 * Two rules decide what happens, and they are not the same rule:
 *
 *  - The **mint** decides whether the transaction exists for us at all. A
 *    transfer of anything other than the configured mint is dropped without a
 *    trace, so a scam token cannot buy itself a moment on a streamer's screen.
 *  - The **memo** decides whether an alert fires. A tip with an unreadable memo
 *    is still money that arrived, so it is recorded; it just stays silent.
 *
 * The channel is identified by the recipient's token account owner, which is an
 * on-chain fact, and never by the channel id inside the memo, which the donor
 * types. When the two disagree, the memo loses.
 */
import { decodeMemo, type DecodedMemo } from '@tipvault/shared';

/** Log line `tip_direct` emits. Keep in step with the program. */
const MEMO_LOG_PREFIX = 'Program log: tipvault-memo: ';
const MEMO_PROGRAM_IDS = new Set([
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
  'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
]);

/** The slice of a parsed transaction this module needs. */
export interface ParsedLike {
  slot: number;
  meta: {
    err: unknown;
    logMessages?: string[] | null;
    preTokenBalances?: TokenBalanceLike[] | null;
    postTokenBalances?: TokenBalanceLike[] | null;
  } | null;
  transaction: {
    message: {
      instructions: InstructionLike[];
    };
  };
}

export interface TokenBalanceLike {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string };
}

export interface InstructionLike {
  programId: { toBase58(): string } | string;
  parsed?: unknown;
  data?: string;
}

/** A credit of the expected mint into a known recipient. */
export interface Credit {
  owner: string;
  mint: string;
  amount: bigint;
}

export type Classification =
  | { kind: 'tip'; credit: Credit; memo: DecodedMemo; raw: string; slot: number }
  | { kind: 'unreadable-memo'; credit: Credit; raw: string | null; slot: number }
  | { kind: 'channel-mismatch'; credit: Credit; memo: DecodedMemo; raw: string; slot: number }
  | { kind: 'ignored'; reason: IgnoreReason };

export type IgnoreReason =
  'transaction-failed' | 'no-token-movement' | 'other-mint' | 'unknown-recipient';

export interface ClassifyOptions {
  /** The only mint that may reach an overlay. */
  mint: string;
  /** Recipient address → channel id, from the `channels` table. */
  channelByRecipient: ReadonlyMap<string, string>;
}

/**
 * Net credit per token account owner, from the balance deltas the runtime
 * reports.
 *
 * Deltas are used rather than the instruction list because they are the
 * settled truth: a transfer routed through a CPI, a helper program or several
 * instructions at once still shows up here exactly once, at its net value.
 */
export function creditsOf(parsed: ParsedLike, mint: string): Credit[] {
  const meta = parsed.meta;
  if (!meta) {
    return [];
  }

  const before = new Map<number, bigint>();
  for (const balance of meta.preTokenBalances ?? []) {
    before.set(balance.accountIndex, BigInt(balance.uiTokenAmount.amount));
  }

  const byOwner = new Map<string, bigint>();
  for (const balance of meta.postTokenBalances ?? []) {
    if (balance.mint !== mint || !balance.owner) {
      continue;
    }
    const delta = BigInt(balance.uiTokenAmount.amount) - (before.get(balance.accountIndex) ?? 0n);
    if (delta <= 0n) {
      continue;
    }
    byOwner.set(balance.owner, (byOwner.get(balance.owner) ?? 0n) + delta);
  }

  return [...byOwner].map(([owner, amount]) => ({ owner, mint, amount }));
}

/**
 * The memo text, from our program's log or from an SPL Memo instruction.
 *
 * Both sources matter: our own tips carry the memo in the log, while anything
 * built by another protocol puts it in the Memo program — and that second case
 * is exactly the "foreign protocol" input the codec has to survive.
 */
export function memoOf(parsed: ParsedLike): string | null {
  for (const line of parsed.meta?.logMessages ?? []) {
    if (line.startsWith(MEMO_LOG_PREFIX)) {
      return line.slice(MEMO_LOG_PREFIX.length);
    }
  }

  for (const instruction of parsed.transaction.message.instructions) {
    const programId =
      typeof instruction.programId === 'string'
        ? instruction.programId
        : instruction.programId.toBase58();
    if (!MEMO_PROGRAM_IDS.has(programId)) {
      continue;
    }
    if (typeof instruction.parsed === 'string') {
      return instruction.parsed;
    }
    if (instruction.parsed && typeof instruction.parsed === 'object') {
      const info = (instruction.parsed as { info?: unknown }).info;
      if (typeof info === 'string') {
        return info;
      }
    }
  }

  return null;
}

export function classify(parsed: ParsedLike, options: ClassifyOptions): Classification {
  if (parsed.meta?.err) {
    return { kind: 'ignored', reason: 'transaction-failed' };
  }

  const credits = creditsOf(parsed, options.mint);
  if (credits.length === 0) {
    // Either nothing moved, or what moved was not the mint we accept. The
    // difference matters only for the log line, never for what we store.
    const movedSomething = (parsed.meta?.postTokenBalances ?? []).length > 0;
    return { kind: 'ignored', reason: movedSomething ? 'other-mint' : 'no-token-movement' };
  }

  const credit = credits.find((entry) => options.channelByRecipient.has(entry.owner));
  if (!credit) {
    return { kind: 'ignored', reason: 'unknown-recipient' };
  }

  const channelId = options.channelByRecipient.get(credit.owner) as string;
  const slot = parsed.slot;

  const raw = memoOf(parsed);
  if (raw === null) {
    return { kind: 'unreadable-memo', credit, raw: null, slot };
  }

  // `decodeMemo` is total by contract: garbage, a foreign protocol and a future
  // version all come back as null rather than as an exception (§5.1).
  const memo = decodeMemo(raw);
  if (!memo) {
    return { kind: 'unreadable-memo', credit, raw, slot };
  }
  if (memo.channelId !== channelId) {
    return { kind: 'channel-mismatch', credit, memo, raw, slot };
  }
  return { kind: 'tip', credit, memo, raw, slot };
}
