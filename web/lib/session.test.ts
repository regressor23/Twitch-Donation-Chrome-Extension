/**
 * The signing helpers carry the dashboard's whole authentication story, so the
 * tests here are written as attacks rather than as round trips: each one is a
 * thing someone would actually try.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { seal, unseal } from './session';

const SECRET = 'a'.repeat(48);
let previous: string | undefined;

beforeAll(() => {
  previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = SECRET;
});

afterAll(() => {
  process.env.SESSION_SECRET = previous;
});

interface Session {
  twitchUserId: string;
  login: string;
}

const session: Session = { twitchUserId: '123456789', login: 'regressor' };

describe('seal / unseal', () => {
  it('returns the value it was given', () => {
    const token = seal('session', session, 60);
    expect(unseal<Session>('session', token)).toEqual(session);
  });

  it('refuses a token minted for another purpose', () => {
    // The attack: take the state parameter handed out by the sign-in redirect,
    // which anyone can read off their own address bar, and present it as a
    // session cookie.
    const state = seal('oauth-state', session, 60);
    expect(unseal<Session>('session', state)).toBeNull();
    expect(unseal<Session>('oauth-state', state)).toEqual(session);
  });

  it('refuses a payload edited after signing', () => {
    const token = seal('session', session, 60);
    const [payload, mac] = token.split('.');
    const forged = JSON.parse(
      Buffer.from(payload as string, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    forged.v = { twitchUserId: '999', login: 'someone-else' };
    const edited = `${Buffer.from(JSON.stringify(forged), 'utf8').toString('base64url')}.${mac}`;

    expect(unseal<Session>('session', edited)).toBeNull();
  });

  it('refuses a token signed with a different secret', () => {
    const token = seal('session', session, 60);
    process.env.SESSION_SECRET = 'b'.repeat(48);
    expect(unseal<Session>('session', token)).toBeNull();
    process.env.SESSION_SECRET = SECRET;
  });

  it('refuses an expired token even though the signature is valid', () => {
    const token = seal('session', session, -1);
    expect(unseal<Session>('session', token)).toBeNull();
  });

  it('refuses an extended expiry, because exp is inside the signature', () => {
    const token = seal('session', session, -1);
    const [payload, mac] = token.split('.');
    const envelope = JSON.parse(
      Buffer.from(payload as string, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    envelope.exp = Math.floor(Date.now() / 1000) + 3600;
    const extended = `${Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url')}.${mac}`;

    expect(unseal<Session>('session', extended)).toBeNull();
  });

  it('refuses a token with no signature at all', () => {
    const payload = Buffer.from(JSON.stringify({ v: session, exp: 2_000_000_000 })).toString(
      'base64url',
    );
    expect(unseal<Session>('session', payload)).toBeNull();
    expect(unseal<Session>('session', `${payload}.`)).toBeNull();
  });

  it('refuses nothing, empty strings and junk without throwing', () => {
    for (const bad of [undefined, null, '', '.', '..', 'not-a-token', 'a.b.c']) {
      expect(unseal<Session>('session', bad)).toBeNull();
    }
  });

  it('keeps two purposes independent even for the same value', () => {
    const a = seal('wallet-challenge', session, 60);
    const b = seal('overlay', session, 60);
    expect(a).not.toEqual(b);
    expect(unseal<Session>('overlay', a)).toBeNull();
    expect(unseal<Session>('wallet-challenge', b)).toBeNull();
  });
});
