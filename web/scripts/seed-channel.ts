/**
 * Seeds the one test channel and its overlay token.
 *
 * S3 has no dashboard and no Twitch OAuth yet (both are S4), so the row goes in
 * from here. The token is 32 random bytes, base64url, and is printed once —
 * afterwards it lives only in the database and never in a log line (§5.3).
 *
 *   pnpm --filter @tipvault/web devnet:seed
 */
import { randomBytes } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { closeDb, db } from '../lib/db/client';
import { alertConfigs, channels } from '../lib/db/schema';
import { loadLocalEnv } from '../lib/env';

loadLocalEnv();

const CHANNEL_ID = process.env.TEST_CHANNEL_ID ?? '123456789';
const LOGIN = 'tipvault_test';

async function main(): Promise<void> {
  const recipient = process.env.TEST_STREAMER;
  const mint = process.env.USDC_MINT;
  if (!recipient || !mint) {
    throw new Error('run devnet:setup first — TEST_STREAMER and USDC_MINT are missing');
  }

  await db()
    .insert(channels)
    .values({
      channelId: CHANNEL_ID,
      login: LOGIN,
      displayName: 'TipVault Test',
      mode: 'direct',
      recipient,
      mint,
      minTip: '1000000',
      presets: ['1000000', '2000000', '5000000'],
      active: true,
    })
    .onConflictDoUpdate({
      target: channels.channelId,
      set: { recipient, mint, active: true },
    });

  const existing = await db()
    .select({ token: alertConfigs.overlayToken })
    .from(alertConfigs)
    .where(eq(alertConfigs.channelId, CHANNEL_ID))
    .limit(1);

  const token = existing[0]?.token ?? randomBytes(32).toString('base64url');
  if (!existing[0]) {
    await db().insert(alertConfigs).values({ channelId: CHANNEL_ID, overlayToken: token });
  }

  console.log(`channel   ${CHANNEL_ID} (${LOGIN})`);
  console.log(`recipient ${recipient}`);
  console.log(`mint      ${mint}`);
  console.log(`overlay   /overlay/${token}`);
  await closeDb();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
