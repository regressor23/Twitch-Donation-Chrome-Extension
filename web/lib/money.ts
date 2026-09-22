/**
 * Money on screen.
 *
 * §4.4 forbids floats in amounts, and the rule does not stop at the database:
 * `Number('18446744073709551615') / 1e6` is wrong before it is ever rounded.
 * Everything here works in `bigint` and produces the string directly.
 *
 * Amounts arrive as decimal strings because the driver returns `numeric` that
 * way, so the input type is `string` rather than `bigint` — converting once,
 * here, keeps the call sites free of `BigInt(...)` noise.
 */
import { USDC_DECIMALS } from '@tipvault/shared';

const SCALE = 10n ** BigInt(USDC_DECIMALS);

/** Cents per whole unit: USDC has six decimals, we show two. */
const CENTS = SCALE / 100n;

/**
 * Minor units → `$1.50`.
 *
 * Truncates rather than rounds. A tip of 1.999999 USDC shown as `$2.00` would
 * be a number the streamer never received, and rounding up is the direction
 * that invites the complaint.
 */
export function formatUsdc(minor: string | bigint): string {
  let value: bigint;
  try {
    value = typeof minor === 'bigint' ? minor : BigInt(minor === '' ? '0' : minor);
  } catch {
    return '$0.00';
  }
  const negative = value < 0n;
  if (negative) {
    value = -value;
  }
  const whole = value / SCALE;
  const cents = (value % SCALE) / CENTS;
  return `${negative ? '-' : ''}$${whole}.${cents.toString().padStart(2, '0')}`;
}
