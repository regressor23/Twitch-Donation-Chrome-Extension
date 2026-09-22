/**
 * Finishes Twitch sign-in.
 *
 * Three things have to agree before a session is issued: the `state` in the URL
 * must carry our signature, it must still be inside its ten minutes, and it
 * must be byte-identical to the one in this browser's cookie. Any one of them
 * missing means this callback belongs to a login somebody else started.
 */
import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import {
  cookieOptions,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sealSession,
  upsertCreator,
} from '../../../../../lib/auth';
import { unseal } from '../../../../../lib/session';
import { signedInUser } from '../../../../../lib/twitch';
import { STATE_COOKIE } from '../start/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Sign-in failures land back on the home page with a reason, never a stack. */
function failed(request: Request, reason: string): NextResponse {
  const url = new URL('/', request.url);
  url.searchParams.set('signin', reason);
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Twitch sends the user back here with `error=access_denied` when they press
  // Cancel. That is not a failure worth a scary message.
  if (url.searchParams.get('error')) {
    return failed(request, 'cancelled');
  }
  if (!code || !state) {
    return failed(request, 'incomplete');
  }

  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1);

  if (!cookie || !sameString(cookie, state) || !unseal('oauth-state', state)) {
    return failed(request, 'state');
  }

  let creatorId: string;
  let user;
  try {
    user = await signedInUser(code);
    creatorId = await upsertCreator(user);
  } catch (error) {
    console.error('[auth] twitch sign-in failed', error);
    return failed(request, 'twitch');
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  response.cookies.set(
    SESSION_COOKIE,
    sealSession({ twitchUserId: user.id, login: user.login, creatorId }),
    { ...cookieOptions, maxAge: SESSION_TTL_SECONDS },
  );
  response.cookies.delete(STATE_COOKIE);
  return response;
}
