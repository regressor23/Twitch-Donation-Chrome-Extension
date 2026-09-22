/**
 * Accepts the signature and, if it holds up, points the channel's payouts at
 * that wallet.
 *
 * This is the only place in the product that decides where money goes, so it
 * trusts exactly two things: our own seal on the challenge, and ed25519. In
 * particular it never takes the wallet address from the request body — the
 * address is the one inside the sealed challenge, so a client cannot sign for
 * one address and register another.
 *
 * A first successful verification is also what creates the channel: until a
 * streamer has proven a payout wallet there is nothing to resolve, nothing to
 * tip and no overlay to hand out.
 */
import { randomBytes } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { readSession } from '../../../../lib/auth';
import { db } from '../../../../lib/db/client';
import { alertConfigs, channels, wallets } from '../../../../lib/db/schema';
import { env } from '../../../../lib/env';
import { unseal } from '../../../../lib/session';
import {
  challengeMessage,
  verifyWalletSignature,
  type Challenge,
} from '../../../../lib/wallet-proof';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** $1, in USDC minor units (§5.2). */
const MIN_TIP = '1000000';
const PRESETS = ['1000000', '2000000', '5000000'];

export async function POST(request: Request): Promise<NextResponse> {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'not signed in', code: 'session' }, { status: 401 });
  }

  let body: { challenge?: unknown; signature?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid json', code: 'other' }, { status: 400 });
  }

  const challenge =
    typeof body.challenge === 'string'
      ? unseal<Challenge>('wallet-challenge', body.challenge)
      : null;
  if (!challenge) {
    return NextResponse.json({ error: 'challenge expired', code: 'expired' }, { status: 400 });
  }

  // The challenge is bound to a channel. A cookie swapped between the two
  // requests must not be able to move somebody else's proof onto this account.
  if (challenge.twitchUserId !== session.twitchUserId) {
    return NextResponse.json(
      { error: 'challenge belongs to another account', code: 'session' },
      { status: 403 },
    );
  }

  const signature =
    typeof body.signature === 'string' ? Buffer.from(body.signature, 'base64') : null;
  if (
    !signature ||
    !verifyWalletSignature(challengeMessage(challenge), challenge.wallet, signature)
  ) {
    return NextResponse.json(
      { error: 'signature does not match', code: 'mismatch' },
      { status: 400 },
    );
  }

  const now = new Date();
  const recipient = challenge.wallet;

  await db()
    .insert(wallets)
    .values({ creatorId: session.creatorId, address: recipient, verifiedAt: now })
    .onConflictDoUpdate({
      target: [wallets.creatorId, wallets.address],
      set: { verifiedAt: now },
    });

  await db()
    .insert(channels)
    .values({
      channelId: session.twitchUserId,
      creatorId: session.creatorId,
      login: session.login,
      displayName: session.login,
      mode: 'direct',
      recipient,
      mint: env().USDC_MINT,
      minTip: MIN_TIP,
      presets: PRESETS,
    })
    .onConflictDoUpdate({
      target: channels.channelId,
      // Only what this action is about: a later login change or a new wallet.
      set: { creatorId: session.creatorId, login: session.login, recipient },
    });

  // The overlay token is created once and then only ever rotated, so a
  // reconnected wallet does not silently invalidate the link in OBS.
  await db()
    .insert(alertConfigs)
    .values({
      channelId: session.twitchUserId,
      overlayToken: randomBytes(32).toString('base64url'),
    })
    .onConflictDoNothing({ target: alertConfigs.channelId });

  const [saved] = await db()
    .select({ recipient: channels.recipient })
    .from(channels)
    .where(eq(channels.channelId, session.twitchUserId))
    .limit(1);

  return NextResponse.json({
    recipient: saved?.recipient ?? recipient,
    verifiedAt: now.toISOString(),
  });
}
