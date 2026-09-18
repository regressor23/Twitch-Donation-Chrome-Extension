import type { ReactNode } from 'react';

export const metadata = {
  title: 'TipVault',
  description: 'USDC tips for Twitch streamers on Solana',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
