'use client';

import { useEffect, useState, type ReactElement } from 'react';

import type { Locale } from '../../../lib/i18n';

/** What the server can honestly say: the instant, in UTC, to the minute. */
function utc(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/**
 * A timestamp in the reader's own timezone.
 *
 * The server has no idea where the streamer is, so it renders UTC; a
 * server-rendered local time would be a hydration mismatch in every timezone
 * but the server's. The first client render is therefore identical to the
 * server's, and the effect replaces it once the browser's zone is known.
 */
export function LocalTime({ iso, locale }: { iso: string; locale: Locale }): ReactElement {
  const [text, setText] = useState(() => utc(iso));

  useEffect(() => {
    setText(
      new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(iso),
      ),
    );
  }, [iso, locale]);

  return <time dateTime={iso}>{text}</time>;
}
