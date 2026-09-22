import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { overlayTarget } from '../../lib/overlay';
import { AlertClient } from './alert-client';
import { OVERLAY_COOKIE } from './[token]/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** OBS keeps the page open for hours; nothing about it should be cached. */
export const metadata = { title: 'TipVault overlay', robots: { index: false, follow: false } };

/**
 * The stage OBS renders.
 *
 * It identifies the channel from the cookie set by `/overlay/<token>`, so the
 * token never appears in this URL or in the stream URL underneath it. A source
 * that has not been linked yet — or whose token was rotated — gets a 404 here,
 * which is the same answer a wrong link gets and tells a prober nothing.
 */
export default async function OverlayPage(): Promise<React.ReactElement> {
  const token = (await cookies()).get(OVERLAY_COOKIE)?.value;
  const target = token ? await overlayTarget(token) : null;

  if (!target) {
    notFound();
  }

  return <AlertClient soundEnabled={target.soundEnabled} ttsEnabled={target.ttsEnabled} />;
}
