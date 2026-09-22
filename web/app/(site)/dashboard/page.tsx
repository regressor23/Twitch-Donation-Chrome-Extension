import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { dashboardData, readSession } from '../../../lib/auth';
import { explorerTx } from '../../../lib/explorer';
import { dictionary, localeFrom, translate, type MessageKey } from '../../../lib/i18n';
import { formatUsdc } from '../../../lib/money';

import { LocalTime } from './local-time';
import { OverlayCard } from './overlay-card';
import { WalletCard } from './wallet-card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'TipVault — dashboard',
  robots: { index: false, follow: false },
};

/** `tips.status` is a closed set in the schema; this mirrors it. */
const STATUS: Record<string, MessageKey> = {
  seen: 'tips.status.seen',
  confirmed: 'tips.status.confirmed',
  alerted: 'tips.status.alerted',
};

/**
 * The streamer's own page.
 *
 * Everything on it is read from the database on every request, keyed by the
 * Twitch user id inside the session cookie — never by anything in the URL.
 * There is no route parameter here to tamper with, which is what keeps one
 * streamer out of another's overlay token.
 */
export default async function DashboardPage(): Promise<ReactElement> {
  const session = await readSession();
  if (!session) {
    redirect('/');
  }

  const data = await dashboardData(session);
  const locale = localeFrom((await headers()).get('accept-language'));
  const t = dictionary(locale);

  if (!data) {
    // The cookie is signed and unexpired but names a creator who is no longer
    // in the database. Redirecting is not an option — sign-out is a POST by
    // design, and the sign-in page would bounce this session straight back
    // here — so the page offers the one action that fixes it.
    return (
      <main>
        <h1>{t['dashboard.title']}</h1>
        <p className="warn">{t['error.session']}</p>
        <form action="/api/auth/logout" method="post">
          <button type="submit">{t['dashboard.signOut']}</button>
        </form>
      </main>
    );
  }

  return (
    <main>
      <div className="spread">
        <h1>{t['dashboard.title']}</h1>
        <form action="/api/auth/logout" method="post" className="row">
          <span className="small muted">
            {translate(locale, 'dashboard.signedInAs', { login: data.login })}
          </span>
          <button className="secondary" type="submit">
            {t['dashboard.signOut']}
          </button>
        </form>
      </div>

      <WalletCard
        locale={locale}
        recipient={data.channel?.recipient ?? null}
        verifiedAt={data.walletVerifiedAt?.toISOString() ?? null}
      />

      {data.hasOverlay ? (
        <OverlayCard locale={locale} />
      ) : (
        <section className="card">
          <h2>{t['overlay.title']}</h2>
          <p>{t['dashboard.noChannel']}</p>
        </section>
      )}

      <section className="card">
        <h2>{t['tips.title']}</h2>
        {data.tips.length === 0 ? (
          <p>{t['tips.empty']}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t['tips.when']}</th>
                <th>{t['tips.who']}</th>
                <th>{t['tips.amount']}</th>
                <th>{t['tips.message']}</th>
                <th>{t['tips.status']}</th>
              </tr>
            </thead>
            <tbody>
              {data.tips.map((tip) => (
                <tr key={tip.signature}>
                  <td className="small muted">
                    <LocalTime iso={tip.seenAt.toISOString()} locale={locale} />
                  </td>
                  <td>{tip.nick ?? '—'}</td>
                  <td className="mono">{tip.amount ? formatUsdc(tip.amount) : '—'}</td>
                  <td>{tip.message ?? ''}</td>
                  <td className="small">
                    <a
                      href={explorerTx(tip.signature)}
                      title={t['tips.viewTx']}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {t[STATUS[tip.status] ?? 'tips.status.seen']}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
