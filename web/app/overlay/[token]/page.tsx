import { notFound } from 'next/navigation';

import { overlayTarget } from '../../../lib/overlay';
import { AlertClient } from './alert-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** OBS keeps the page open for hours; nothing about it should be cached. */
export const metadata = { title: 'TipVault overlay', robots: { index: false, follow: false } };

export default async function OverlayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.ReactElement> {
  const { token } = await params;
  const target = await overlayTarget(token);

  if (!target) {
    notFound();
  }

  return (
    <AlertClient token={token} soundEnabled={target.soundEnabled} ttsEnabled={target.ttsEnabled} />
  );
}
