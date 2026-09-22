/**
 * Alert stream for a linked browser source.
 *
 * The overlay identifies itself with the HttpOnly cookie set by
 * `/overlay/<token>`, so this URL is the same for every streamer and carries
 * nothing an access log should not see. The cookie holds the token, not a
 * signed channel id, so the database still has the final say — rotating the
 * token from the dashboard cuts this stream off on its next reconnect, which
 * is what makes the rotate button worth having.
 */
import { cookies } from 'next/headers';

import { overlayTarget } from '../../../../lib/overlay';
import { alertStream } from '../../../../lib/sse';
import { OVERLAY_COOKIE } from '../../../overlay/[token]/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const token = (await cookies()).get(OVERLAY_COOKIE)?.value;
  const target = token ? await overlayTarget(token) : null;

  if (!target) {
    return new Response('not found', { status: 404 });
  }

  return alertStream(target, request.signal);
}
