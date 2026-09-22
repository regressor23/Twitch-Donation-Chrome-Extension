/**
 * Proving that a streamer actually controls the wallet they typed in.
 *
 * Without this step the dashboard would happily point a channel's payouts at
 * any address on Solana, including one the streamer copied from a scammer's
 * message. The proof is an ed25519 signature over a message the server minted,
 * which is the only evidence that does not rely on trusting the browser.
 *
 * The message is deliberately readable: wallets show it to the person before
 * they sign, and a prompt full of base64 teaches people to approve without
 * looking. It names the site, the Twitch login, the wallet and the expiry, so
 * a signature captured here cannot be replayed on another site, for another
 * channel, or next week.
 *
 * Verification uses Node's own ed25519 rather than a library: a raw 32-byte
 * public key becomes a key object by prefixing the fixed SPKI header below,
 * which is twelve bytes that never change for this curve.
 */
import { createPublicKey, verify } from 'node:crypto';

/** DER SPKI header for Ed25519: SEQUENCE, OID 1.3.101.112, BIT STRING. */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/** How long a signed challenge stays good. Long enough to read it, then sign. */
export const CHALLENGE_TTL_SECONDS = 300;

export interface Challenge {
  twitchUserId: string;
  login: string;
  wallet: string;
  issuedAt: number;
}

/**
 * The exact text the wallet will display and sign.
 *
 * Any change here invalidates challenges already in flight, which is harmless
 * — they expire in five minutes — but it must stay byte-identical between the
 * side that issues it and the side that verifies it, so it is built in one
 * place and never assembled in a component.
 */
export function challengeMessage(challenge: Challenge): string {
  return [
    'TipVault: confirm this wallet receives your tips.',
    '',
    `Twitch channel: ${challenge.login} (${challenge.twitchUserId})`,
    `Wallet: ${challenge.wallet}`,
    `Issued: ${new Date(challenge.issuedAt * 1000).toISOString()}`,
    '',
    'Signing costs nothing and sends no transaction.',
  ].join('\n');
}

/** base58, 32 bytes — the same shape check the env validator uses. */
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Minimal base58 decode; the alternative is pulling in a library for 20 lines. */
export function decodeBase58(input: string): Uint8Array | null {
  let bytes: number[] = [0];
  for (const char of input) {
    const value = BASE58.indexOf(char);
    if (value < 0) {
      return null;
    }
    let carry = value;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += (bytes[i] as number) * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading '1's in base58 are leading zero bytes.
  for (const char of input) {
    if (char !== '1') {
      break;
    }
    bytes.push(0);
  }
  bytes = bytes.reverse();
  return Uint8Array.from(bytes);
}

/**
 * True only when `signature` is this exact `wallet`'s signature over `message`.
 *
 * Returns false rather than throwing for every kind of malformed input: a
 * caller that has to tell "bad base58" from "bad signature" would end up
 * reporting the difference to whoever is probing.
 */
export function verifyWalletSignature(
  message: string,
  wallet: string,
  signature: Uint8Array,
): boolean {
  const publicKey = decodeBase58(wallet);
  if (!publicKey || publicKey.length !== 32 || signature.length !== 64) {
    return false;
  }

  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey)]),
      format: 'der',
      type: 'spki',
    });
    return verify(null, Buffer.from(message, 'utf8'), key, Buffer.from(signature));
  } catch {
    return false;
  }
}
