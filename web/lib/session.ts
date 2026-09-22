/**
 * Signed, self-contained values: session cookies, OAuth state, the
 * wallet-ownership challenge and the overlay cookie.
 *
 * All four are the same shape — a small JSON payload the client holds and hands
 * back, which we must be able to trust without storing anything. HMAC-SHA256
 * over the payload does that, so none of them needs a table, a lookup, or a
 * cleanup job for expired rows.
 *
 * Two details that are the whole point:
 *
 *  - **`purpose` is part of the signature.** Without it a value minted for one
 *    job verifies for another: an OAuth state would pass as a session cookie
 *    and hand out a dashboard. Mixing the purpose into the MAC makes each one
 *    useless anywhere but where it was issued.
 *  - **The expiry is inside the signed payload**, never beside it. A cookie's
 *    own `Max-Age` is a request to the browser; this is a fact the server can
 *    check.
 *
 * This is not encryption: anyone holding a token can read its payload. Nothing
 * secret goes in one — a Twitch user id and a login are not secrets, and the
 * overlay cookie carries a channel id, not the overlay token.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import { sessionSecret } from './env';

/** What each kind of token is for. Part of the signature, never optional. */
export type Purpose = 'session' | 'oauth-state' | 'wallet-challenge' | 'overlay';

interface Envelope<T> {
  v: T;
  /** Unix seconds. Checked on every unseal. */
  exp: number;
}

function macOf(purpose: Purpose, payload: string): Buffer {
  return createHmac('sha256', sessionSecret()).update(`${purpose}.${payload}`).digest();
}

export function seal<T>(purpose: Purpose, value: T, ttlSeconds: number): string {
  const envelope: Envelope<T> = { v: value, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const payload = Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
  return `${payload}.${macOf(purpose, payload).toString('base64url')}`;
}

/**
 * Returns the value, or null for anything that is not a currently valid token
 * of this exact purpose. Every failure looks the same on purpose: a caller that
 * could tell "wrong signature" from "expired" would leak that difference on.
 */
export function unseal<T>(purpose: Purpose, token: string | undefined | null): T | null {
  if (!token) {
    return null;
  }
  const dot = token.lastIndexOf('.');
  if (dot <= 0) {
    return null;
  }

  const payload = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1), 'base64url');
  const expected = macOf(purpose, payload);
  // timingSafeEqual throws on a length mismatch, which is itself an answer.
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const envelope = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Envelope<T>;
    if (typeof envelope.exp !== 'number' || envelope.exp * 1000 < Date.now()) {
      return null;
    }
    return envelope.v;
  } catch {
    // A payload that is not our JSON, carrying a signature that is ours, means
    // something is very wrong; treat it as invalid and say nothing more.
    return null;
  }
}
