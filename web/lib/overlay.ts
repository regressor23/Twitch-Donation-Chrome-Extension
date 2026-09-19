/**
 * Overlay tokens.
 *
 * The token is the only thing standing between a URL and someone else's alerts,
 * so it is looked up by exact match and never written to a log line (§5.3).
 */
import { eq } from 'drizzle-orm';

import { db } from './db/client';
import { alertConfigs } from './db/schema';

export interface OverlayTarget {
  channelId: string;
  soundEnabled: boolean;
  ttsEnabled: boolean;
  minAlert: bigint;
}

export async function overlayTarget(token: string): Promise<OverlayTarget | null> {
  if (token.length < 16) {
    return null;
  }
  const rows = await db()
    .select()
    .from(alertConfigs)
    .where(eq(alertConfigs.overlayToken, token))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    channelId: row.channelId,
    soundEnabled: row.soundEnabled,
    ttsEnabled: row.ttsEnabled,
    minAlert: BigInt(row.minAlert),
  };
}
