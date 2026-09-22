import { describe, expect, it } from 'vitest';

import { formatUsdc } from './money';

describe('formatUsdc', () => {
  it('formats whole and fractional amounts', () => {
    expect(formatUsdc('1000000')).toBe('$1.00');
    expect(formatUsdc('1500000')).toBe('$1.50');
    expect(formatUsdc('0')).toBe('$0.00');
    expect(formatUsdc('10000')).toBe('$0.01');
  });

  it('truncates instead of rounding up', () => {
    // Showing $2.00 for a tip of 1.999999 would name an amount that never
    // arrived, and in the direction that gets complained about.
    expect(formatUsdc('1999999')).toBe('$1.99');
    expect(formatUsdc('9999')).toBe('$0.00');
  });

  it('survives a u64 that does not fit in a double', () => {
    // 18446744073709551615 minor units. Number() would already have lost
    // digits before any division happened.
    expect(formatUsdc('18446744073709551615')).toBe('$18446744073709.55');
  });

  it('accepts bigint as well as the string the driver returns', () => {
    expect(formatUsdc(2_500_000n)).toBe('$2.50');
  });

  it('does not throw on empty or malformed input', () => {
    expect(formatUsdc('')).toBe('$0.00');
    expect(formatUsdc('not a number')).toBe('$0.00');
  });
});
