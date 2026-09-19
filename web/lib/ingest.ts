/**
 * The one path from a signature to a row, shared by the webhook and the poller.
 *
 * Neither trigger is believed about anything: both hand over a signature, and
 * everything else is read from the chain (§4.6). Running the same signature
 * twice is safe — `tips.signature` is the primary key, so the second insert
 * simply finds the row already there.
 *
 * How the three statuses are used, since §5.4 names them but not their edges:
 *
 *  - `seen`      — recorded, but not something to put on a screen: the memo was
 *                  unreadable or belonged to another protocol, or the RPC had
 *                  not caught up yet. A row here never advances on its own.
 *  - `confirmed` — verified on chain and waiting for an overlay. This is the
 *                  alert queue, and `tips_channel_pending` indexes exactly it.
 *  - `alerted`   — delivered to at least one overlay.
 */
import type { AlertEvent } from '@tipvault/shared';
import { eq } from 'drizzle-orm';

import { publish, toAlert } from './alerts';
import { db } from './db/client';
import { channels, events, tips } from './db/schema';
import { env } from './env';
import { fetchTransaction } from './solana';
import { classify, type IgnoreReason } from './tx';

export type IngestOutcome =
  | { kind: 'alert'; signature: string; alert: AlertEvent }
  | { kind: 'recorded-silent'; signature: string; reason: 'unreadable-memo' | 'channel-mismatch' }
  | { kind: 'duplicate'; signature: string }
  | { kind: 'deferred'; signature: string }
  | { kind: 'ignored'; reason: IgnoreReason };

export interface IngestOptions {
  source: 'webhook' | 'poll';
  /** The channel the poller was walking, when it was walking one. */
  channelHint?: string;
}

/** Recipient address → channel id, for every channel we still watch. */
export async function channelByRecipient(): Promise<Map<string, string>> {
  const rows = await db()
    .select({ channelId: channels.channelId, recipient: channels.recipient })
    .from(channels)
    .where(eq(channels.active, true));
  return new Map(rows.map((row) => [row.recipient, row.channelId]));
}

export async function ingestSignature(
  signature: string,
  options: IngestOptions,
): Promise<IngestOutcome> {
  const recipients = await channelByRecipient();
  const parsed = await fetchTransaction(signature);

  if (!parsed) {
    // The node has not indexed it yet. With a channel in hand we can park the
    // row for the poller; without one there is nothing to attach it to, so the
    // signature goes to `events` and the poller will find it again by address.
    if (options.channelHint) {
      await db()
        .insert(tips)
        .values({
          signature,
          channelId: options.channelHint,
          status: 'seen',
          source: options.source,
        })
        .onConflictDoNothing();
    } else {
      await db()
        .insert(events)
        .values({
          kind: 'signature_deferred',
          signature,
          payload: { source: options.source },
        });
    }
    return { kind: 'deferred', signature };
  }

  const verdict = classify(parsed, {
    mint: env().USDC_MINT,
    channelByRecipient: recipients,
  });

  if (verdict.kind === 'ignored') {
    // Nothing is written, on purpose. A transfer of some other token must not
    // even leave a trace an overlay could later read — that is what stops a
    // scam token from buying a moment on a streamer's screen.
    return { kind: 'ignored', reason: verdict.reason };
  }

  // `classify` only returns these three kinds for a credit it matched to a
  // channel, so the lookup cannot miss.
  const channelId = recipients.get(verdict.credit.owner) as string;
  const alertable = verdict.kind === 'tip';
  const now = new Date();

  const inserted = await db()
    .insert(tips)
    .values({
      signature,
      channelId,
      amount: verdict.credit.amount.toString(),
      mint: verdict.credit.mint,
      nick: verdict.kind === 'tip' ? verdict.memo.nick : null,
      message: verdict.kind === 'tip' ? verdict.memo.message : null,
      status: alertable ? 'confirmed' : 'seen',
      slot: verdict.slot,
      source: options.source,
      confirmedAt: now,
    })
    .onConflictDoNothing({ target: tips.signature })
    .returning();

  const row = inserted[0];
  if (!row) {
    // `onConflictDoNothing` returned nothing: this signature is already stored,
    // which is the whole point of the primary key.
    return { kind: 'duplicate', signature };
  }

  if (!alertable) {
    return {
      kind: 'recorded-silent',
      signature,
      reason: verdict.kind === 'unreadable-memo' ? 'unreadable-memo' : 'channel-mismatch',
    };
  }

  const alert = toAlert(row);
  publish(alert);
  return { kind: 'alert', signature, alert };
}
