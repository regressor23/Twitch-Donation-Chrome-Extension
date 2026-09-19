/**
 * Forces a fallback sweep on demand.
 *
 * The scheduled sweep runs inside the server process (see instrumentation.ts);
 * this endpoint exists so a test can demand one immediately instead of waiting
 * out the interval. The work itself lives in lib/poll.ts — both callers must
 * take the same path, or the tested code is not the running code.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { env } from '../../../../lib/env';
import { sweep } from '../../../../lib/poll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(header: string | null): boolean {
  const expected = `Bearer ${env().INTERNAL_TASK_SECRET}`;
  if (!header) {
    return false;
  }
  const a = createHash('sha256').update(header).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!authorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await sweep());
}
