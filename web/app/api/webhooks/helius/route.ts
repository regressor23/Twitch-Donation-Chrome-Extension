/**
 * Helius transaction webhook.
 *
 * Helius does not sign its payloads the way GitHub does — it can only echo a
 * static value in the `Authorization` header, which is what we configure and
 * compare here. That alone would be thin, so nothing in the body is believed:
 * the handler takes the signatures out of it and re-reads every transaction
 * from our own RPC (see lib/ingest.ts). A forged call therefore buys nothing,
 * because the chain has to agree.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { db } from '../../../../lib/db/client';
import { events } from '../../../../lib/db/schema';
import { env } from '../../../../lib/env';
import { ingestSignature } from '../../../../lib/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Constant-time compare that also hides the length of the expected value. */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) {
    return false;
  }
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Signatures out of a Helius payload.
 *
 * Enhanced webhooks put `signature` at the top level, raw ones carry
 * `transaction.signatures[0]`. Both are accepted so a change of webhook type in
 * the dashboard does not quietly stop the indexer.
 */
export function signaturesOf(body: unknown): string[] {
  const items = Array.isArray(body) ? body : [body];
  const found: string[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const { signature, transaction } = item as {
      signature?: unknown;
      transaction?: { signatures?: unknown };
    };

    if (typeof signature === 'string' && signature.length > 0) {
      found.push(signature);
      continue;
    }
    const raw = transaction?.signatures;
    if (Array.isArray(raw) && typeof raw[0] === 'string') {
      found.push(raw[0]);
    }
  }

  return [...new Set(found)];
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!secretMatches(request.headers.get('authorization'), env().HELIUS_WEBHOOK_SECRET)) {
    // No detail in the body: an attacker probing the endpoint learns nothing
    // about whether the secret was close.
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // One real Helius body, stored so the idempotency test can replay the thing
  // Helius actually sent instead of a hand-written mock. Off unless the
  // variable is set, and it holds nothing the `tips` row does not already hold.
  // Railway truncates long log lines, so this goes to the audit table, not a
  // console.log — a truncated capture would be a forged capture.
  if (process.env.HELIUS_CAPTURE === '1') {
    await db()
      .insert(events)
      .values({ kind: 'helius_raw', payload: body as Record<string, unknown> });
  }

  const signatures = signaturesOf(body);
  if (signatures.length === 0) {
    // 200, not 400: a payload we cannot read is not something Helius should
    // retry for the next three days.
    console.warn('[helius] payload carried no signatures');
    return NextResponse.json({ accepted: 0 });
  }

  const outcomes = [];
  for (const signature of signatures) {
    try {
      const outcome = await ingestSignature(signature, { source: 'webhook' });
      console.log(
        `[helius] ${signature} -> ${outcome.kind}`,
        'reason' in outcome ? outcome.reason : '',
      );
      outcomes.push(outcome.kind);
    } catch (error) {
      // A failure here must surface as 5xx so Helius retries; the alternative
      // is a tip that silently never happened.
      console.error(`[helius] ${signature} failed`, error);
      return NextResponse.json({ error: 'ingest failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ accepted: outcomes.length, outcomes });
}
