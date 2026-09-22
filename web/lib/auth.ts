/**
 * Who is signed in, and what they are allowed to see.
 *
 * The session is a signed cookie and nothing more (lib/session.ts): there is no
 * sessions table, so signing out is a cookie deletion and an expired session
 * cannot outlive its `exp` by sitting in a row nobody cleans up.
 *
 * What the cookie carries is deliberately small — a Twitch user id, a login and
 * our own creator id. Everything a page actually needs is read from the
 * database on each request, so a stale cookie cannot show stale money.
 */
import { cookies } from 'next/headers';

import { db } from './db/client';
import { alertConfigs, channels, creators, tips, wallets } from './db/schema';
import { seal, unseal } from './session';
import type { TwitchUser } from './twitch';

import { and, desc, eq } from 'drizzle-orm';

export const SESSION_COOKIE = 'tv_session';

/** Two weeks: long enough that a streamer is not signed out mid-stream. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export interface SessionValue {
  twitchUserId: string;
  login: string;
  creatorId: string;
}

/**
 * Cookie flags used for every cookie this app sets.
 *
 * `httpOnly` because no script has a reason to read it, and `sameSite: 'lax'`
 * because the OAuth callback is a top-level navigation from Twitch — `strict`
 * would drop the cookie exactly when it is being established.
 */
export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
} as const;

export function sealSession(value: SessionValue): string {
  return seal('session', value, SESSION_TTL_SECONDS);
}

export async function readSession(): Promise<SessionValue | null> {
  const store = await cookies();
  return unseal<SessionValue>('session', store.get(SESSION_COOKIE)?.value);
}

/**
 * Creates the creator row on first sign-in, refreshes the display name after.
 *
 * `login` is what Twitch shows in a URL and it can change; `twitch_user_id`
 * never does, which is why the lookup is by id and the login is merely stored.
 */
export async function upsertCreator(user: TwitchUser): Promise<string> {
  const [row] = await db()
    .insert(creators)
    .values({
      twitchUserId: user.id,
      login: user.login,
      displayName: user.displayName,
    })
    .onConflictDoUpdate({
      target: creators.twitchUserId,
      set: { login: user.login, displayName: user.displayName },
    })
    .returning({ id: creators.id });

  if (!row) {
    throw new Error('creator upsert returned no row');
  }
  return row.id;
}

/** How many rows the tip history shows. Paging is not worth it at this size. */
export const RECENT_TIPS = 20;

export interface RecentTip {
  signature: string;
  amount: string | null;
  nick: string | null;
  message: string | null;
  status: string;
  seenAt: Date;
}

export interface DashboardData {
  creatorId: string;
  twitchUserId: string;
  login: string;
  displayName: string;
  channel: {
    channelId: string;
    recipient: string;
    mode: string;
    mint: string;
    minTip: string;
    active: boolean;
  } | null;
  hasOverlay: boolean;
  walletVerifiedAt: Date | null;
  tips: RecentTip[];
}

/**
 * Everything the dashboard renders, in one query set.
 *
 * The channel is looked up by the Twitch user id from the session, never by a
 * parameter from the request: that is what stops a signed-in streamer from
 * asking for somebody else's overlay token.
 */
export async function dashboardData(session: SessionValue): Promise<DashboardData | null> {
  const [creator] = await db()
    .select()
    .from(creators)
    .where(eq(creators.id, session.creatorId))
    .limit(1);

  if (!creator) {
    return null;
  }

  const [channel] = await db()
    .select()
    .from(channels)
    .where(eq(channels.channelId, session.twitchUserId))
    .limit(1);

  // Whether there is an overlay at all — never the token. It reaches the
  // browser only through /api/overlay/link, on request.
  const overlay = channel
    ? await db()
        .select({ channelId: alertConfigs.channelId })
        .from(alertConfigs)
        .where(eq(alertConfigs.channelId, channel.channelId))
        .limit(1)
    : [];

  // When the payout wallet was proven. Looked up by the address the channel
  // actually pays to, so a stale row for a wallet that was replaced cannot
  // lend its date to the new one.
  const proof = channel
    ? await db()
        .select({ verifiedAt: wallets.verifiedAt })
        .from(wallets)
        .where(and(eq(wallets.creatorId, creator.id), eq(wallets.address, channel.recipient)))
        .limit(1)
    : [];

  // Nothing is selected from `tips` that a donor did not choose to put on a
  // stream: a nick, a message and an amount. §5.4 keeps donor identity out of
  // the table in the first place, so there is none here to leak.
  const recent = channel
    ? await db()
        .select({
          signature: tips.signature,
          amount: tips.amount,
          nick: tips.nick,
          message: tips.message,
          status: tips.status,
          seenAt: tips.seenAt,
        })
        .from(tips)
        .where(eq(tips.channelId, channel.channelId))
        .orderBy(desc(tips.seenAt))
        .limit(RECENT_TIPS)
    : [];

  return {
    creatorId: creator.id,
    twitchUserId: session.twitchUserId,
    login: creator.login,
    displayName: creator.displayName,
    channel: channel
      ? {
          channelId: channel.channelId,
          recipient: channel.recipient,
          mode: channel.mode,
          mint: channel.mint,
          minTip: channel.minTip,
          active: channel.active,
        }
      : null,
    hasOverlay: overlay.length > 0,
    walletVerifiedAt: proof[0]?.verifiedAt ?? null,
    tips: recent,
  };
}
