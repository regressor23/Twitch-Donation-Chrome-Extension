/**
 * Exchanges the overlay link for a cookie, once, and gets the token out of the
 * URL for good.
 *
 * Why this exists: Railway's edge logs every request path, so `GET
 * /api/overlay/<token>/stream` put the token into an access log on every single
 * reconnect — and an SSE source reconnects for as long as the stream runs
 * (docs/security.md §4). A browser source that visits this route once trades
 * the link for an HttpOnly cookie and from then on asks for `/overlay` and
 * `/api/overlay/stream`, which carry nothing worth logging.
 *
 * The cookie holds the token itself, not a signed copy of the channel id. That
 * is deliberate: every request still resolves it against the database, so
 * rotating from the dashboard cuts an open overlay off immediately. A sealed
 * channel id would keep working until it expired, which would make the rotate
 * button a lie.
 */
import { NextResponse } from 'next/server';

import { cookieOptions } from '../../../lib/auth';
import { overlayTarget } from '../../../lib/overlay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OVERLAY_COOKIE = 'tv_overlay';

/** OBS keeps a browser source open for months; re-linking it is a chore. */
const OVERLAY_TTL_SECONDS = 60 * 60 * 24 * 180;

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await context.params;

  // Checked here so a wrong link fails at the moment it is pasted, rather than
  // silently setting a cookie that never produces an alert.
  const target = await overlayTarget(token);
  if (!target) {
    return new NextResponse('not found', { status: 404 });
  }

  const response = NextResponse.redirect(new URL('/overlay', request.url));
  response.cookies.set(OVERLAY_COOKIE, token, {
    ...cookieOptions,
    maxAge: OVERLAY_TTL_SECONDS,
  });
  return response;
}
