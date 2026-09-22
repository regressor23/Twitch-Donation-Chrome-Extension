'use client';

/**
 * Connect a wallet, prove it, and point the channel's payouts at it.
 *
 * This is the one screen in the product that decides where money goes, so the
 * proof is a signature and not a text field: the streamer types nothing, and an
 * address cannot be pasted in by anyone who is merely signed in.
 *
 * The address travels to the server once, inside a sealed challenge — the
 * verify route reads it back out of that seal rather than out of the request
 * body, so what was signed and what gets saved cannot drift apart.
 */
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { failureKey } from '../../../lib/api-error';
import { dictionary, type Locale, type MessageKey } from '../../../lib/i18n';
import { availableWallets, type WalletHandle } from '../../../lib/wallet-standard';

import { LocalTime } from './local-time';

interface Props {
  locale: Locale;
  recipient: string | null;
  verifiedAt: string | null;
}

type Stage = 'idle' | 'choosing' | 'connecting' | 'signing';

/** Wallets disagree on how "the user pressed Cancel" comes back. */
function declined(error: unknown): boolean {
  if ((error as { code?: unknown } | null)?.code === 4001) {
    return true;
  }
  const message = String((error as Error | null)?.message ?? '').toLowerCase();
  return message.includes('reject') || message.includes('declined') || message.includes('cancel');
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function WalletCard({ locale, recipient, verifiedAt }: Props): ReactElement {
  const router = useRouter();
  const t = dictionary(locale);
  const [stage, setStage] = useState<Stage>('idle');
  const [choices, setChoices] = useState<WalletHandle[]>([]);
  const [problem, setProblem] = useState<MessageKey | null>(null);

  const busy = stage === 'connecting' || stage === 'signing';

  async function prove(handle: WalletHandle): Promise<void> {
    setProblem(null);
    setChoices([]);
    setStage('connecting');
    try {
      const wallet = await handle.connect();

      const asked = await post('/api/wallet/challenge', { wallet: wallet.address });
      if (!asked.ok) {
        setProblem(await failureKey(asked));
        setStage('idle');
        return;
      }
      const { message, challenge } = (await asked.json()) as { message: string; challenge: string };

      setStage('signing');
      const signature = await wallet.signMessage(message);

      const verified = await post('/api/wallet/verify', {
        challenge,
        signature: base64(signature),
      });
      if (!verified.ok) {
        setProblem(await failureKey(verified));
        setStage('idle');
        return;
      }

      setStage('idle');
      // The server component owns what is on screen; re-render it rather than
      // keep a second copy of the wallet in this component's state.
      router.refresh();
    } catch (error) {
      setProblem(declined(error) ? 'error.declined' : 'error.other');
      setStage('idle');
    }
  }

  function start(): void {
    const wallets = availableWallets();
    if (wallets.length === 0) {
      // Advice rather than a failure: it says what to install.
      setProblem('wallet.noWallets');
      return;
    }
    setProblem(null);
    if (wallets.length === 1 && wallets[0]) {
      void prove(wallets[0]);
      return;
    }
    setChoices(wallets);
    setStage('choosing');
  }

  function cancel(): void {
    setChoices([]);
    setStage('idle');
  }

  return (
    <section className="card">
      <div className="spread">
        <h2>{t['wallet.title']}</h2>
        {recipient && verifiedAt ? (
          <span className="small good">
            {t['wallet.verified']} <LocalTime iso={verifiedAt} locale={locale} />
          </span>
        ) : null}
      </div>
      <p>{t['wallet.lead']}</p>

      {recipient ? (
        <p className="mono">{recipient}</p>
      ) : (
        <p className="warn small">{t['wallet.none']}</p>
      )}

      {problem ? <p className="warn small">{t[problem]}</p> : null}

      {stage === 'choosing' ? (
        <>
          <p className="small">{t['wallet.choose']}</p>
          <div className="row">
            {choices.map((wallet) => (
              <button key={wallet.name} className="secondary" onClick={() => void prove(wallet)}>
                {wallet.name}
              </button>
            ))}
            <button className="secondary" onClick={cancel}>
              {t['common.cancel']}
            </button>
          </div>
        </>
      ) : (
        <div className="row">
          <button onClick={start} disabled={busy}>
            {stage === 'connecting'
              ? t['wallet.connecting']
              : stage === 'signing'
                ? t['wallet.signing']
                : recipient
                  ? t['wallet.change']
                  : t['wallet.connect']}
          </button>
          <span className="small muted">{t['wallet.signHint']}</span>
        </div>
      )}
    </section>
  );
}
