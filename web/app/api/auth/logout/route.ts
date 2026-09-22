/**
 * Signs out.
 *
 * POST, not GET: a sign-out on GET can be triggered by an image tag on any
 * page on the internet, which is a nuisance rather than a breach, but there is
 * no reason to accept it.
 *
 * Deleting the cookie is the whole of it — the session lives in the cookie, so
 * there is no server-side record left behind to go stale.
 */
import { NextResponse } from 'next/server';

import { cookieOptions, SESSION_COOKIE } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const response = NextResponse.redirect(new URL('/', request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  return response;
}
