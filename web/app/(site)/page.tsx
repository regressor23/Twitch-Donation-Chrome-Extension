import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { readSession } from '../../lib/auth';
import { dictionary, localeFrom, type MessageKey } from '../../lib/i18n';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sign-in failures arrive as `?signin=<reason>` from the OAuth callback.
 *
 * The lookup is a closed table rather than a string built from the parameter:
 * whatever a link puts in that query string, only these four sentences can
 * ever reach the page.
 */
const REASONS: Record<string, MessageKey> = {
  cancelled: 'signin.error.cancelled',
  incomplete: 'signin.error.incomplete',
  state: 'signin.error.state',
  twitch: 'signin.error.twitch',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  if (await readSession()) {
    redirect('/dashboard');
  }

  const locale = localeFrom((await headers()).get('accept-language'));
  const t = dictionary(locale);
  const reason = (await searchParams).signin;
  const problem = typeof reason === 'string' ? REASONS[reason] : undefined;

  return (
    <main>
      {/* Text only, no marks: CLAUDE.md §4.7 allows the words and nothing else. */}
      <p className="small muted">{t['common.appName']} · USDC tips for Twitch</p>
      <h1>{t['signin.title']}</h1>
      <p>{t['signin.lead']}</p>

      {problem ? <p className="warn small">{t[problem]}</p> : null}

      <p>
        <a className="button" href="/api/auth/twitch/start">
          {t['signin.button']}
        </a>
      </p>
      <p className="small muted">{t['signin.scopes']}</p>
    </main>
  );
}
