import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MEMO_LIMITS, decodeMemo, encodeMemo, memoByteLength, normalizeMemoInput } from './memo';

const RUNS = { numRuns: 500 };

const U64_MAX = 18_446_744_073_709_551_615n;

const channelIdArb = fc.bigInt({ min: 1n, max: U64_MAX }).map(String);

/** Full grapheme soup: emoji sequences, combining marks, RTL, CJK, controls. */
const textArb = fc.string({ unit: 'grapheme', maxLength: 400 });

const inputArb = fc.record({
  channelId: channelIdArb,
  nick: textArb,
  message: textArb,
});

/** Anything at all, including bytes that are not valid UTF-8. */
const rawArb = fc.oneof(
  fc.string({ unit: 'binary', maxLength: 400 }),
  fc.string({ unit: 'grapheme', maxLength: 400 }),
  fc.uint8Array({ maxLength: 600 }),
  // Structurally memo-shaped garbage, so the parser branches are reached often.
  fc
    .array(fc.string({ unit: 'binary', maxLength: 30 }), { maxLength: 6 })
    .map((parts) => `tv1|${parts.join('|')}`),
);

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemes = (value: string): string[] =>
  Array.from(segmenter.segment(value), (part) => part.segment);

// eslint-disable-next-line no-control-regex -- matching control characters is the whole point: they are stripped
const FORBIDDEN_RE = /[\u{0000}-\u{001F}\u{007F}-\u{009F}\u{202A}-\u{202E}\u{2066}-\u{2069}|]/u;
const LONE_SURROGATE_RE = /[\u{D800}-\u{DFFF}]/u;

describe('encodeMemo — invariants', () => {
  it('never exceeds the 300-byte ceiling', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        expect(memoByteLength(encodeMemo(input))).toBeLessThanOrEqual(MEMO_LIMITS.maxBytes);
      }),
      RUNS,
    );
  });

  it('always produces something decodable, with the channel id intact', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const decoded = decodeMemo(encodeMemo(input));
        expect(decoded).not.toBeNull();
        expect(decoded?.channelId).toBe(input.channelId);
      }),
      RUNS,
    );
  });

  it('stays inside the grapheme limits', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const decoded = decodeMemo(encodeMemo(input));
        expect(graphemes(decoded?.nick ?? '').length).toBeLessThanOrEqual(
          MEMO_LIMITS.nickMaxGraphemes,
        );
        expect(graphemes(decoded?.message ?? '').length).toBeLessThanOrEqual(
          MEMO_LIMITS.messageMaxGraphemes,
        );
      }),
      RUNS,
    );
  });

  it('emits no separators, control characters or lone surrogates', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const decoded = decodeMemo(encodeMemo(input));
        for (const field of [decoded?.nick ?? '', decoded?.message ?? '']) {
          expect(FORBIDDEN_RE.test(field)).toBe(false);
          expect(LONE_SURROGATE_RE.test(field)).toBe(false);
        }
      }),
      RUNS,
    );
  });
});

describe('round trip', () => {
  it('decode(encode(x)) equals the normalised input', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        expect(decodeMemo(encodeMemo(input))).toEqual(normalizeMemoInput(input));
      }),
      RUNS,
    );
  });

  it('is stable: encode(decode(encode(x))) === encode(x)', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const once = encodeMemo(input);
        const decoded = decodeMemo(once);
        expect(decoded).not.toBeNull();
        expect(encodeMemo(decoded as Parameters<typeof encodeMemo>[0])).toBe(once);
      }),
      RUNS,
    );
  });
});

describe('truncation never splits a grapheme', () => {
  const clusters = [
    '\u{1F469}\u{200D}\u{1F469}\u{200D}\u{1F467}', // family, 18 bytes
    '\u{1F1FA}\u{1F1E6}', // flag, 8 bytes
    '\u{1F44D}\u{1F3FD}', // thumb with skin tone, 8 bytes
    '\u{1F600}', // plain emoji, 4 bytes
    'я', // Cyrillic, 2 bytes
    '漢', // CJK, 3 bytes
  ];

  it('keeps whole clusters only, whatever the budget cuts off', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...clusters),
        fc.integer({ min: 1, max: 200 }),
        channelIdArb,
        (cluster, count, channelId) => {
          const decoded = decodeMemo(
            encodeMemo({ channelId, nick: '', message: cluster.repeat(count) }),
          );
          const parts = graphemes(decoded?.message ?? '');
          // Every surviving grapheme is the whole cluster, never a fragment.
          expect(parts.every((part) => part === cluster)).toBe(true);
          expect(parts.join('')).toBe(decoded?.message);
        },
      ),
      RUNS,
    );
  });
});

describe('decodeMemo — total function', () => {
  it('never throws, whatever the chain hands over', () => {
    fc.assert(
      fc.property(rawArb, (raw) => {
        const result = decodeMemo(raw);
        expect(result === null || typeof result === 'object').toBe(true);
      }),
      RUNS,
    );
  });

  it('rejects every version that is not tv1', () => {
    fc.assert(
      fc.property(
        fc
          .string({ unit: 'binary', minLength: 1, maxLength: 8 })
          .filter((version) => version !== 'tv1' && !version.includes('|')),
        channelIdArb,
        (version, channelId) => {
          expect(decodeMemo(`${version}|${channelId}|nick|hi`)).toBeNull();
        },
      ),
      RUNS,
    );
  });

  it('accepts anything encodeMemo produced, byte-for-byte', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const memo = encodeMemo(input);
        expect(decodeMemo(new TextEncoder().encode(memo))).toEqual(decodeMemo(memo));
      }),
      RUNS,
    );
  });
});
