/**
 * Begins Twitch sign-in.
 *
 * The `state` parameter is both signed and mirrored in a cookie. The signature
 * stops anyone from inventing a state; the cookie is what makes the callback
 * refuse a login someone else started — without it, an attacker can complete
 * their own Twitch login in a victim's browser and leave them signed in as the
 * attacker, which is how a dashboard ends up pointing at the wrong wallet.
 */
import { randomBytes } from 'node:crypto';

import { NextResponse } from 'next/server';

import { cookieOptions } from '../../../../../lib/auth';
import { seal } from '../../../../../lib/session';
import { authorizeUrl } from '../../../../../lib/twitch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const STATE_COOKIE = 'tv_oauth_state';

/** Long enough to sign in, short enough that a stale tab cannot be replayed. */
const STATE_TTL_SECONDS = 600;

export async function GET(): Promise<NextResponse> {
  let target: string;
  const state = seal(
    'oauth-state',
    { n: randomBytes(16).toString('base64url') },
    STATE_TTL_SECONDS,
  );

  try {
    target = authorizeUrl(state);
  } catch (error) {
    // Twitch credentials missing: say so plainly instead of redirecting into a
    // page that would fail with something unrelated.
    return NextResponse.json({ error: (error as Error).message }, { status: 503 });
  }

  const response = NextResponse.redirect(target);
  response.cookies.set(STATE_COOKIE, state, { ...cookieOptions, maxAge: STATE_TTL_SECONDS });
  return response;
}
