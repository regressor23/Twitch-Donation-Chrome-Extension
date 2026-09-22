import type { ReactElement, ReactNode } from 'react';

import './globals.css';

/**
 * This layout exists for its import.
 *
 * Every page that is a web page — sign-in, dashboard — sits under `(site)` and
 * gets the stylesheet here. The overlay sits outside it and stays transparent.
 * See the note in the root layout for why that matters.
 */
export default function SiteLayout({ children }: { children: ReactNode }): ReactElement {
  return <>{children}</>;
}
