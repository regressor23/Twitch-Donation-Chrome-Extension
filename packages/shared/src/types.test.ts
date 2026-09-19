import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromU64String, toU64String } from './types';

const U64_MAX = 18_446_744_073_709_551_615n;

describe('u64 wire conversion', () => {
  it('round-trips every u64 without touching a float', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: U64_MAX }), (value) => {
        expect(fromU64String(toU64String(value))).toBe(value);
      }),
      { numRuns: 500 },
    );
  });

  it('keeps precision where Number would lose it', () => {
    const beyondSafeInteger = 9_007_199_254_740_993n; // 2^53 + 1
    expect(fromU64String(toU64String(beyondSafeInteger))).toBe(beyondSafeInteger);
    // Number() rounds it down to 2^53; going through a string keeps it exact.
    expect(BigInt(Number(beyondSafeInteger.toString()))).not.toBe(beyondSafeInteger);
  });

  it.each([
    ['negative', -1n],
    ['over u64', U64_MAX + 1n],
  ])('rejects %s on the way out', (_name, value) => {
    expect(() => toU64String(value)).toThrow(RangeError);
  });

  it.each([
    ['empty', ''],
    ['letters', 'abc'],
    ['leading zero', '01'],
    ['padded', ' 1 '],
    ['decimal point', '1.0'],
    ['scientific', '1e6'],
    ['negative', '-1'],
    ['hex', '0x10'],
  ])('rejects %s on the way in', (_name, value) => {
    expect(() => fromU64String(value)).toThrow(TypeError);
  });

  it('rejects a decimal string beyond u64', () => {
    expect(() => fromU64String((U64_MAX + 1n).toString())).toThrow(RangeError);
  });
});
