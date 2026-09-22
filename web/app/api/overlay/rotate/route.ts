/**
 * Replaces the channel's overlay token (§5.3: rotated from the dashboard).
 *
 * The token is a bearer credential with a real blast radius — reading every
 * tip as it arrives, and swallowing alerts before the streamer's own overlay
 * sees them (docs/security.md §4) — so rotating it has to be one click, not a
 * support request. Anything that reaches a screen share, a chat log or a
 * platform's access log must be replaceable immediately.
 *
 * The channel comes from the session, never from the request: this endpoint
 * can only ever rotate the caller's own token.
 */
import { randomBytes } from 'node:crypto';

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

  const token = randomBytes(32).toString('base64url');
  const updated = await db()
    .update(alertConfigs)
    .set({ overlayToken: token, rotatedAt: new Date() })
    .where(eq(alertConfigs.channelId, session.twitchUserId))
    .returning({ channelId: alertConfigs.channelId });

  if (updated.length === 0) {
    return NextResponse.json(
      { error: 'no overlay for this channel yet', code: 'other' },
      { status: 404 },
    );
  }

  // Returned so the page can show the new link without a round trip; it is
  // never logged, and the response is uncacheable by construction (POST).
  return NextResponse.json({ token });
}
