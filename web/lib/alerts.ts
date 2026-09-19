/**
 * The alert queue and the in-process fan-out to connected overlays.
 *
 * The queue is the `tips` table itself: a row with status `confirmed` is an
 * alert that has not been shown yet, and `alerted` is one that has. That means
 * an overlay reconnecting after OBS restarted still gets what it missed, and
 * nothing needs a second source of truth to go stale.
 *
 * The live push is a plain emitter, which is enough while the app is one
 * process. The day it runs on several, this is the seam to replace with
 * Postgres LISTEN/NOTIFY — the catch-up query keeps working either way.
 */
import { EventEmitter } from 'node:events';

import type { AlertEvent } from '@tipvault/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { db } from './db/client';
import { tips } from './db/schema';

const holder = globalThis as unknown as { __tipvaultBus?: EventEmitter };

function bus(): EventEmitter {
  if (!holder.__tipvaultBus) {
    const emitter = new EventEmitter();
    // One listener per connected overlay; a popular streamer may have the
    // browser source open in several scenes at once.
    emitter.setMaxListeners(64);
    holder.__tipvaultBus = emitter;
  }
  return holder.__tipvaultBus;
}

export function publish(alert: AlertEvent): void {
  bus().emit(alert.channelId, alert);
}

export function subscribe(channelId: string, listener: (alert: AlertEvent) => void): () => void {
  bus().on(channelId, listener);
  return () => {
    bus().off(channelId, listener);
  };
}

/** Confirmed tips this channel has never shown, oldest first. */
export async function pendingAlerts(channelId: string): Promise<AlertEvent[]> {
  const rows = await db()
    .select()
    .from(tips)
    .where(and(eq(tips.channelId, channelId), eq(tips.status, 'confirmed'), isNull(tips.alertedAt)))
    .orderBy(asc(tips.seenAt))
    .limit(20);

  return rows.map(toAlert);
}

export function toAlert(row: typeof tips.$inferSelect): AlertEvent {
  return {
    id: row.signature,
    channelId: row.channelId,
    signature: row.signature,
    nick: row.nick ?? '',
    message: row.message ?? '',
    amount: row.amount ?? '0',
    mint: row.mint ?? '',
    createdAt: (row.confirmedAt ?? row.seenAt).toISOString(),
  };
}

/**
 * Marks a tip as shown.
 *
 * Deliberately only moves `confirmed` → `alerted`: two overlays racing on the
 * same tip both deliver it to the same screen, and the second update must not
 * rewrite a timestamp the first one already set.
 */
export async function markAlerted(signature: string): Promise<void> {
  await db()
    .update(tips)
    .set({ status: 'alerted', alertedAt: new Date() })
    .where(and(eq(tips.signature, signature), eq(tips.status, 'confirmed')));
}
