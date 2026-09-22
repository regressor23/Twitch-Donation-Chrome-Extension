'use client';

/**
 * The overlay link, and the button that replaces it.
 *
 * The token is not a prop. It is fetched when the streamer asks to copy or
 * reveal it, because this page is often open on a monitor that is on stream —
 * anything rendered into the document is one screenshot or one View Source
 * away, and whoever reads this token can send an arbitrary alert to that stream
 * and swallow real ones before the streamer's own overlay sees them
 * (docs/security.md §4).
 *
 * Copying therefore never puts it on screen at all, which is the normal path.
 */
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';

import { failureKey } from '../../../lib/api-error';
import { dictionary, type Locale, type MessageKey } from '../../../lib/i18n';

export function OverlayCard({ locale }: { locale: Locale }): ReactElement {
  const router = useRouter();
  const t = dictionary(locale);
  const [origin, setOrigin] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [problem, setProblem] = useState<MessageKey | null>(null);

  // The server does not know which host the streamer reached us on — it may be
  // a custom domain — and the browser already has the other half of the link.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  /** The link, fetched once and kept for as long as it is the current one. */
  async function link(): Promise<string | null> {
    if (url) {
      return url;
    }
    const response = await fetch('/api/overlay/link', { method: 'POST' });
    if (!response.ok) {
      setProblem(await failureKey(response));
      return null;
    }
    const { token } = (await response.json()) as { token: string };
    const built = `${origin}/overlay/${token}`;
    setUrl(built);
    return built;
  }

  async function copy(): Promise<void> {
    setBusy(true);
    setProblem(null);
    try {
      const target = await link();
      if (!target) {
        return;
      }
      await navigator.clipboard.writeText(target);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; revealing lets them copy by hand.
      setRevealed(true);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(): Promise<void> {
    if (revealed) {
      setRevealed(false);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      if (await link()) {
        setRevealed(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function rotate(): Promise<void> {
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch('/api/overlay/rotate', { method: 'POST' });
      if (!response.ok) {
        setProblem(await failureKey(response));
        return;
      }
      // Whatever was on screen or in the clipboard is dead now. Drop it rather
      // than leave a link that looks live.
      setUrl(null);
      setRevealed(false);
      setCopied(false);
      setConfirming(false);
      setRotated(true);
      router.refresh();
    } catch {
      setProblem('error.other');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>{t['overlay.title']}</h2>
      <p>{t['overlay.lead']}</p>

      {revealed && url ? (
        <input className="field" readOnly value={url} onFocus={(event) => event.target.select()} />
      ) : (
        <p className="mono muted">{t['overlay.hidden']}</p>
      )}

      {rotated ? <p className="good small">{t['overlay.rotated']}</p> : null}
      {problem ? <p className="warn small">{t[problem]}</p> : null}

      {confirming ? (
        <>
          <p className="warn small">{t['overlay.rotateWarning']}</p>
          <div className="row">
            <button onClick={() => void rotate()} disabled={busy}>
              {t['overlay.rotate']}
            </button>
            <button className="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              {t['common.cancel']}
            </button>
          </div>
        </>
      ) : (
        <div className="row">
          <button onClick={() => void copy()} disabled={busy || !origin}>
            {copied ? t['common.copied'] : t['common.copy']}
          </button>
          <button className="secondary" onClick={() => void toggle()} disabled={busy || !origin}>
            {revealed ? t['overlay.hide'] : t['overlay.reveal']}
          </button>
          <button className="secondary" onClick={() => setConfirming(true)} disabled={busy}>
            {t['overlay.rotate']}
          </button>
        </div>
      )}
    </section>
  );
}
