/**
 * Hands the overlay token to the streamer who owns it, on request.
 *
 * The dashboard could have been given the token as a prop, and for a while it
 * was. That put it in the page source of a tab streamers keep open on a
 * monitor that is often captured — hiding it behind a Reveal button then only
 * hid it from a glance, not from a screenshot, an extension reading the DOM or
 * anyone who pressed View Source.
 *
 * Fetching it means the token reaches the browser only when someone asks for
 * it, and it travels in a POST body rather than a path, so it stays out of the
 * access log that pushed it out of the overlay URL in the first place
 * (docs/security.md §4).
 *
 * POST for the same reason: a GET can be triggered by a link and lands in
 * browser history and prefetch caches.
 */
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { readSession } from '../../../../lib/auth';
import { db } from '../../../../lib/db/client';
import { alertConfigs } from '../../../../lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'not signed in', code: 'session' }, { status: 401 });
  }

  const [row] = await db()
    .select({ token: alertConfigs.overlayToken })
    .from(alertConfigs)
    .where(eq(alertConfigs.channelId, session.twitchUserId))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: 'no overlay for this channel yet', code: 'other' },
      { status: 404 },
    );
  }

  return NextResponse.json({ token: row.token });
}
