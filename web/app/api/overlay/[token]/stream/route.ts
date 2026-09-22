/**
 * Alert stream addressed by the token in the path.
 *
 * Kept for the measurement and acceptance scripts, which have the token in
 * hand and no cookie jar. A browser source should use `/api/overlay/stream`
 * instead: every request here writes the token into the platform's access log
 * (docs/security.md §4), which is acceptable a handful of times from a script
 * and not acceptable on every reconnect for hours.
 */
import { overlayTarget } from '../../../../../lib/overlay';
import { alertStream } from '../../../../../lib/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await context.params;
  const target = await overlayTarget(token);

  if (!target) {
    // The same answer for a malformed token and for one that simply is not
    // ours: nothing here tells a prober which of the two it hit.
    return new Response('not found', { status: 404 });
  }

  return alertStream(target, request.signal);
}
