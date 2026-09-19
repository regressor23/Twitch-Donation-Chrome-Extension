import { describe, expect, it } from 'vitest';
import {
  MEMO_LIMITS,
  MemoError,
  decodeMemo,
  encodeMemo,
  isValidChannelId,
  memoByteLength,
  normalizeMemoInput,
} from './memo';

const utf8 = new TextEncoder();

/** One grapheme cluster each, deliberately expensive in bytes. */
const FAMILY = '\u{1F469}\u{200D}\u{1F469}\u{200D}\u{1F467}'; // 18 bytes
const FLAG = '\u{1F1FA}\u{1F1E6}'; // 8 bytes
const THUMB = '\u{1F44D}\u{1F3FD}'; // 8 bytes

describe('memoByteLength', () => {
  it.each([
    ['ascii', 'abc', 3],
    ['cyrillic', 'Олександр', 18],
    ['family emoji', FAMILY, 18],
    ['flag', FLAG, 8],
    ['skin tone', THUMB, 8],
  ])('counts UTF-8 bytes, not characters: %s', (_name, value, expected) => {
    expect(memoByteLength(value)).toBe(expected);
  });
});

describe('isValidChannelId', () => {
  it.each([
    ['plain id', '123456789', true],
    ['single digit', '7', true],
    ['20 digits', '1'.repeat(20), true],
    ['21 digits', '1'.repeat(21), false],
    ['zero', '0', false],
    ['leading zero', '0123', false],
    ['empty', '', false],
    ['letters', 'abc', false],
    ['negative', '-1', false],
    ['float', '1.5', false],
    ['spaced', ' 123 ', false],
  ])('%s', (_name, value, expected) => {
    expect(isValidChannelId(value)).toBe(expected);
  });
});

describe('normalizeMemoInput', () => {
  it.each([
    [
      'trims and collapses whitespace',
      '  Олександр  ',
      'привіт\n\nсвіт',
      'Олександр',
      'привіт світ',
    ],
    ['strips the separator', 'a|b', 'x|y|z', 'ab', 'xyz'],
    ['strips C0 controls', 'ni\u{0000}ck', 'he\u{0007}llo', 'nick', 'hello'],
    ['strips bidi overrides', '\u{202E}evil', 'a\u{2066}b', 'evil', 'ab'],
    ['strips zero-width space', 'a\u{200B}b', 'c\u{200B}d', 'ab', 'cd'],
    ['composes to NFC', 'e\u{0301}', 'A\u{030A}', '\u{00E9}', '\u{00C5}'],
    ['keeps ZWJ emoji intact', FAMILY, FLAG, FAMILY, FLAG],
    ['tab and CRLF become one space', 'a\tb', 'c\r\nd', 'a b', 'c d'],
  ])('%s', (_name, nick, message, expectedNick, expectedMessage) => {
    expect(normalizeMemoInput({ channelId: '1', nick, message })).toEqual({
      version: 'tv1',
      channelId: '1',
      nick: expectedNick,
      message: expectedMessage,
    });
  });

  it('is idempotent', () => {
    const once = normalizeMemoInput({ channelId: '42', nick: ' a|b\u{0000} ', message: 'x \n y' });
    expect(normalizeMemoInput(once)).toEqual(once);
  });

  it('throws MemoError on an invalid channel id', () => {
    expect(() => normalizeMemoInput({ channelId: 'abc', nick: 'a', message: 'b' })).toThrow(
      MemoError,
    );
    expect(() => encodeMemo({ channelId: '', nick: 'a', message: 'b' })).toThrow(MemoError);
  });
});

describe('encodeMemo', () => {
  it('produces the documented wire format', () => {
    expect(encodeMemo({ channelId: '123456789', nick: 'alex', message: 'gg' })).toBe(
      'tv1|123456789|alex|gg',
    );
  });

  it('keeps empty fields addressable', () => {
    expect(encodeMemo({ channelId: '1', nick: '', message: '' })).toBe('tv1|1||');
  });

  it('cuts the nick at 24 graphemes, not 24 code units', () => {
    const decoded = decodeMemo(encodeMemo({ channelId: '1', nick: 'я'.repeat(30), message: '' }));
    expect(decoded?.nick).toBe('я'.repeat(24));
  });

  it('cuts the message at 180 graphemes', () => {
    const decoded = decodeMemo(encodeMemo({ channelId: '1', nick: '', message: 'a'.repeat(200) }));
    expect(decoded?.message).toBe('a'.repeat(180));
  });

  it('hits the 300-byte ceiling exactly without going over', () => {
    // 3 version + 3 separators + 9 id = 15 bytes of overhead, nick 'a' = 1, so
    // 284 bytes of Cyrillic (142 graphemes, under the 180 limit) lands on 300.
    const memo = encodeMemo({ channelId: '123456789', nick: 'a', message: 'я'.repeat(142) });
    expect(memoByteLength(memo)).toBe(300);
    expect(decodeMemo(memo)?.message).toBe('я'.repeat(142));
  });

  it('clips a message that is inside the grapheme limit but over the byte budget', () => {
    // 180 Cyrillic graphemes = 360 bytes; the budget leaves room for 142.
    const memo = encodeMemo({ channelId: '123456789', nick: 'a', message: 'я'.repeat(180) });
    expect(memoByteLength(memo)).toBe(300);
    expect(decodeMemo(memo)?.message).toBe('я'.repeat(142));
  });

  it('never splits a multi-byte grapheme when clipping', () => {
    // 8 bytes each; the 284-byte budget fits 35 whole clusters (280 bytes).
    const memo = encodeMemo({ channelId: '123456789', nick: 'a', message: THUMB.repeat(50) });
    expect(memoByteLength(memo)).toBe(296);
    expect(decodeMemo(memo)?.message).toBe(THUMB.repeat(35));
  });

  it('clips the nick by bytes and still leaves room for the message', () => {
    // Overhead for id '1' is 7 bytes, so nick + message share 293. A 24-family
    // nick wants 432 bytes; 16 clusters (288) fit and leave exactly 5 for 'hello'.
    const memo = encodeMemo({ channelId: '1', nick: FAMILY.repeat(24), message: 'hello' });
    const decoded = decodeMemo(memo);
    expect(memoByteLength(memo)).toBe(300);
    expect(decoded?.nick).toBe(FAMILY.repeat(16));
    expect(decoded?.message).toBe('hello');
  });
});

describe('decodeMemo — rejects', () => {
  it.each([
    ['empty string', ''],
    ['only separators', '|||'],
    ['only the version', 'tv1'],
    ['three fields, no message', 'tv1|123|nick'],
    ['unknown future version', 'tv2|123|nick|hi'],
    ['older version', 'tv0|123|nick|hi'],
    ['wrong case', 'TV1|123|nick|hi'],
    ['foreign protocol', 'solana:pay?amount=1'],
    ['plain text memo', 'thanks for the stream'],
    ['empty channel id', 'tv1||nick|hi'],
    ['channel id with letters', 'tv1|abc|nick|hi'],
    ['channel id with leading zero', 'tv1|0123|nick|hi'],
    ['channel id zero', 'tv1|0|nick|hi'],
    ['lone surrogate', 'tv1|1|a\u{D800}|b'],
    ['separator before the version', '|tv1|1|nick|hi'],
  ])('%s -> null', (_name, raw) => {
    expect(decodeMemo(raw)).toBeNull();
  });

  it('invalid UTF-8 bytes -> null', () => {
    const bytes = new Uint8Array([...utf8.encode('tv1|1|'), 0xff, 0xfe, ...utf8.encode('|hi')]);
    expect(decodeMemo(bytes)).toBeNull();
  });
});

describe('decodeMemo — accepts', () => {
  it('parses the happy path', () => {
    expect(decodeMemo('tv1|123456789|alex|gg wp')).toEqual({
      version: 'tv1',
      channelId: '123456789',
      nick: 'alex',
      message: 'gg wp',
    });
  });

  it('parses UTF-8 bytes as they arrive from the chain', () => {
    expect(decodeMemo(utf8.encode('tv1|1|нік|привіт'))).toEqual({
      version: 'tv1',
      channelId: '1',
      nick: 'нік',
      message: 'привіт',
    });
  });

  it('keeps the tail as the message when a foreign client left separators in it', () => {
    expect(decodeMemo('tv1|1|nick|a|b|c')?.message).toBe('abc');
  });

  it('clamps an over-long memo instead of dropping a paid tip', () => {
    const raw = `tv1|1|${'я'.repeat(200)}|hello`;
    expect(memoByteLength(raw)).toBeGreaterThan(MEMO_LIMITS.maxBytes);
    expect(decodeMemo(raw)).toEqual({
      version: 'tv1',
      channelId: '1',
      nick: 'я'.repeat(24),
      message: 'hello',
    });
  });

  it('sanitises text that a foreign client did not', () => {
    expect(decodeMemo('tv1|1|\u{202E}evil\u{0000}|a\u{200B}b\tc')).toEqual({
      version: 'tv1',
      channelId: '1',
      nick: 'evil',
      message: 'ab c',
    });
  });

  it('accepts empty nick and message', () => {
    expect(decodeMemo('tv1|1||')).toEqual({
      version: 'tv1',
      channelId: '1',
      nick: '',
      message: '',
    });
  });
});
