/**
 * Codec for the on-chain tip memo.
 *
 * Wire format (CLAUDE.md 5.1):  tv1|<channel_id>|<nick>|<message>
 *
 * The memo is the only path by which viewer-authored text reaches a streamer's
 * overlay, so both directions share one sanitiser: whatever `encodeMemo` refuses
 * to put on chain, `decodeMemo` refuses to hand to the UI. Limits are enforced
 * twice — in grapheme clusters (CLAUDE.md 5.1) and in UTF-8 bytes, because a
 * 24-character Cyrillic nick is 48 bytes and a 180-character emoji message is
 * 720, while the memo itself must never exceed 300 bytes.
 */

export const MEMO_VERSION = 'tv1';

export const MEMO_LIMITS = {
  version: MEMO_VERSION,
  /** Hard ceiling for the whole memo, in UTF-8 bytes. */
  maxBytes: 300,
  nickMaxGraphemes: 24,
  messageMaxGraphemes: 180,
} as const;

export interface MemoInput {
  /** Numeric Twitch user id, as a string: it is an identifier, never an amount. */
  channelId: string;
  nick: string;
  message: string;
}

export interface DecodedMemo {
  version: typeof MEMO_VERSION;
  channelId: string;
  nick: string;
  message: string;
}

/** Thrown by `encodeMemo`/`normalizeMemoInput` only. `decodeMemo` never throws. */
export class MemoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MemoError';
  }
}

const SEPARATOR = '|';
const CHANNEL_ID_RE = /^[1-9][0-9]{0,19}$/;

/** Non-global on purpose: `.test()` on a /g regex is stateful via lastIndex. */
const LONE_SURROGATE_RE = /[\uD800-\uDFFF]/u;

/**
 * Dropped outright: the separator itself, C0/C1 controls, zero-width space,
 * lone surrogates and the bidi controls that let a message visually reorder or
 * mask an alert on stream. U+0009..U+000D are deliberately kept here and folded
 * into spaces by the whitespace pass below; ZWJ (U+200D) and variation
 * selectors are kept because emoji sequences are built out of them.
 */
/* eslint-disable no-control-regex -- matching control characters is the point here: they are stripped */
const REMOVED_RE =
  /[\u0000-\u0008\u000E-\u001F\u007F-\u009F\u061C\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069\uD800-\uDFFF|]/gu;
/* eslint-enable no-control-regex */

const WHITESPACE_RE = /\s+/gu;

const encoder = new TextEncoder();

const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/** Length of `value` in UTF-8 bytes — the unit the chain actually charges for. */
export function memoByteLength(value: string): number {
  return encoder.encode(value).length;
}

export function isValidChannelId(value: string): boolean {
  return CHANNEL_ID_RE.test(value);
}

/**
 * Splits into grapheme clusters, so that a family emoji (one cluster, five code
 * points, 18 bytes) is never cut in half. Falls back to code points where
 * Intl.Segmenter is missing; every target runtime (Node 24, Chrome MV3) has it.
 */
function toGraphemes(value: string): string[] {
  if (segmenter === null) return Array.from(value);
  return Array.from(segmenter.segment(value), (part) => part.segment);
}

/**
 * Order matters: removal first, then whitespace folding, then NFC, then trim.
 * NFC last, because dropping a control character can leave a base letter next
 * to a combining mark that would compose on a second pass — which would make
 * the function non-idempotent and break the round-trip property.
 */
function sanitizeText(value: string): string {
  return value.replace(REMOVED_RE, '').replace(WHITESPACE_RE, ' ').normalize('NFC').trim();
}

function truncateToGraphemes(value: string, maxGraphemes: number): string {
  const graphemes = toGraphemes(value);
  if (graphemes.length <= maxGraphemes) return value;
  return graphemes.slice(0, maxGraphemes).join('');
}

function truncateToBytes(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return '';
  if (memoByteLength(value) <= maxBytes) return value;

  let used = 0;
  let out = '';
  for (const grapheme of toGraphemes(value)) {
    const size = memoByteLength(grapheme);
    if (used + size > maxBytes) break;
    used += size;
    out += grapheme;
  }
  return out;
}

/** Bytes left for nick + message once version, id and separators are paid for. */
function budgetFor(channelId: string): number {
  const overhead = MEMO_VERSION.length + SEPARATOR.length * 3 + channelId.length;
  return MEMO_LIMITS.maxBytes - overhead;
}

/**
 * Exactly what `encodeMemo` will put on chain, as a structure. Exported so the
 * popup can show a live preview of a truncated message, and so the round-trip
 * property has something to compare against that is not the encoder itself.
 *
 * @throws {MemoError} if the channel id is not a Twitch numeric id.
 */
export function normalizeMemoInput(input: MemoInput): DecodedMemo {
  const { channelId } = input;
  if (!isValidChannelId(channelId)) {
    throw new MemoError(`invalid channel id: ${JSON.stringify(channelId)}`);
  }

  let nick = truncateToGraphemes(sanitizeText(input.nick), MEMO_LIMITS.nickMaxGraphemes);
  let message = truncateToGraphemes(sanitizeText(input.message), MEMO_LIMITS.messageMaxGraphemes);

  // The nick keeps its place first: an alert without a message still works,
  // an alert without a name does not. Whatever bytes survive go to the message.
  const budget = budgetFor(channelId);
  if (memoByteLength(nick) > budget) {
    nick = truncateToBytes(nick, budget);
  }
  message = truncateToBytes(message, budget - memoByteLength(nick));

  return {
    version: MEMO_VERSION,
    channelId,
    nick: nick.trimEnd(),
    message: message.trimEnd(),
  };
}

/**
 * Builds the memo string. Never returns more than `MEMO_LIMITS.maxBytes` bytes
 * and never splits a grapheme cluster.
 *
 * @throws {MemoError} if the channel id is not a Twitch numeric id.
 */
export function encodeMemo(input: MemoInput): string {
  const normalized = normalizeMemoInput(input);
  return [MEMO_VERSION, normalized.channelId, normalized.nick, normalized.message].join(SEPARATOR);
}

function toText(raw: string | Uint8Array): string | null {
  if (typeof raw === 'string') {
    return LONE_SURROGATE_RE.test(raw) ? null : raw;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(raw);
  } catch {
    return null;
  }
}

/**
 * Parses a memo. Returns `null` for anything that is not a well-formed tv1
 * memo — unknown version, missing fields, bad channel id, invalid UTF-8 — and
 * never throws, whatever bytes the chain hands over.
 *
 * Deliberately lenient about size: a memo is already paid for by a confirmed
 * transaction, so an over-long nick or message is clamped rather than dropped.
 * Swallowing a paid tip over one extra byte would be the worse failure.
 */
export function decodeMemo(raw: string | Uint8Array): DecodedMemo | null {
  try {
    const text = toText(raw);
    if (text === null) return null;

    const parts = text.split(SEPARATOR);
    if (parts.length < 4) return null;

    const [version, channelId = '', nick = ''] = parts;
    if (version !== MEMO_VERSION) return null;
    if (!isValidChannelId(channelId)) return null;

    // A foreign tv1 client may have left separators inside the message; keep the
    // remainder as the message, the sanitiser strips the separators anyway.
    const message = parts.slice(3).join(SEPARATOR);

    return normalizeMemoInput({ channelId, nick, message });
  } catch {
    return null;
  }
}
