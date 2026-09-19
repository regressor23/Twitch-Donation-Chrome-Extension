/**
 * Shows or rotates a channel's overlay token.
 *
 * §5.3 says the token is rotated from the dashboard; the dashboard arrives in
 * S4, and until then this is how it is done. It exists because the token is a
 * bearer credential: anything that reaches a chat log, a screen share or a
 * transcript has to be replaceable in one command.
 *
 *   pnpm --filter @tipvault/web overlay:token -- --show
 *   pnpm --filter @tipvault/web overlay:token -- --rotate
 */
import { randomBytes } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { db } from '../lib/db/client';
import { alertConfigs } from '../lib/db/schema';
import { loadLocalEnv } from '../lib/env';

loadLocalEnv();

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const index = argv.indexOf('--channel');
  const channelId = (index >= 0 ? argv[index + 1] : null) ?? process.env.TEST_CHANNEL_ID ?? '123456789';

  if (argv.includes('--rotate')) {
    const token = randomBytes(32).toString('base64url');
    const updated = await db()
      .update(alertConfigs)
      .set({ overlayToken: token, rotatedAt: new Date() })
      .where(eq(alertConfigs.channelId, channelId))
      .returning({ channelId: alertConfigs.channelId });
    if (updated.length === 0) {
      throw new Error(`no alert_configs row for channel ${channelId}`);
    }
    // Deliberately not printed: rotation is pointless if the new value lands in
    // the same place the old one leaked from. Read it back with --show.
    console.log(`rotated the overlay token for channel ${channelId}`);
    return;
  }

  const rows = await db()
    .select({ token: alertConfigs.overlayToken, rotatedAt: alertConfigs.rotatedAt })
    .from(alertConfigs)
    .where(eq(alertConfigs.channelId, channelId));
  const row = rows[0];
  if (!row) {
    throw new Error(`no alert_configs row for channel ${channelId}`);
  }
  console.log(row.token);
  console.log(`(rotated ${row.rotatedAt ? row.rotatedAt.toISOString() : 'never'})`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
