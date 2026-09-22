import { headers } from 'next/headers';
import type { ReactElement, ReactNode } from 'react';

import { localeFrom } from '../lib/i18n';

export const metadata = {
  title: 'TipVault',
  description: 'USDC tips for Twitch streamers on Solana',
};

/**
 * The root layout deliberately loads no stylesheet.
 *
 * Site pages get `globals.css` from the `(site)` layout; the overlay does not.
 * That separation is not tidiness — `globals.css` gives `body` an opaque
 * background, and a browser source with an opaque background paints over the
 * game capture underneath it. Both files also define `.card`. Keeping the
 * import out of the root makes the collision impossible instead of unlikely.
 */
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const locale = localeFrom((await headers()).get('accept-language'));
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
