/**
 * Everything a tipper's client needs to build a transaction (CLAUDE.md §5.3).
 *
 * This is the first request the extension makes when a viewer lands on a Twitch
 * page, so it answers with the channel's *current* payout address rather than
 * anything cached in the client: a streamer who changes wallets must not keep
 * receiving tips at the old one.
 *
 * Deliberately public and deliberately thin. It exposes only what a stranger
 * needs in order to pay — never the overlay token, never the creator, never
 * anything about past tips.
 */
import { NextResponse } from 'next/server';

import { eq } from 'drizzle-orm';

import { db } from '../../../../../lib/db/client';
import { channels } from '../../../../../lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ResolvedChannel {
  channelId: string;
  recipient: string;
  mode: string;
  presets: string[];
  minTip: string;
  mint: string;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ login: string }> },
): Promise<NextResponse> {
  const { login } = await context.params;

  // Twitch logins are lower case; a viewer's address bar may not be.
  const [row] = await db()
    .select()
    .from(channels)
    .where(eq(channels.login, login.toLowerCase()))
    .limit(1);

  if (!row || !row.active) {
    // Same answer for "no such streamer" and "not taking tips": a prober
    // learns nothing about which logins exist in our database.
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const body: ResolvedChannel = {
    channelId: row.channelId,
    recipient: row.recipient,
    mode: row.mode,
    presets: row.presets,
    minTip: row.minTip,
    mint: row.mint,
  };

  return NextResponse.json(body, {
    headers: {
      // Short enough that a wallet change takes effect while the streamer is
      // still looking at the dashboard, long enough to absorb a raid.
      'cache-control': 'public, max-age=0, s-maxage=30',
    },
  });
}
