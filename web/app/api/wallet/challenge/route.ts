/**
 * Hands out the message a streamer signs to prove a wallet is theirs.
 *
 * The challenge is sealed rather than stored: it already binds the signed-in
 * channel, the wallet and the moment it was issued, and a signature over it is
 * only worth anything to us if we can still verify our own seal. That means no
 * table of pending challenges and nothing to expire.
 */
import { NextResponse } from 'next/server';

import { readSession } from '../../../../lib/auth';
import { seal } from '../../../../lib/session';
import {
  CHALLENGE_TTL_SECONDS,
  challengeMessage,
  decodeBase58,
  type Challenge,
} from '../../../../lib/wallet-proof';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'not signed in', code: 'session' }, { status: 401 });
  }

  let wallet: unknown;
  try {
    ({ wallet } = (await request.json()) as { wallet?: unknown });
  } catch {
    return NextResponse.json({ error: 'invalid json', code: 'other' }, { status: 400 });
  }

  // Check the address before asking someone to approve a prompt about it: a
  // typo caught here is a sentence, caught later it is a wallet dialog.
  const decoded = typeof wallet === 'string' ? decodeBase58(wallet) : null;
  if (!decoded || decoded.length !== 32) {
    return NextResponse.json({ error: 'not a solana address', code: 'address' }, { status: 400 });
  }

  const challenge: Challenge = {
    twitchUserId: session.twitchUserId,
    login: session.login,
    wallet: wallet as string,
    issuedAt: Math.floor(Date.now() / 1000),
  };

  return NextResponse.json({
    message: challengeMessage(challenge),
    challenge: seal('wallet-challenge', challenge, CHALLENGE_TTL_SECONDS),
  });
}
