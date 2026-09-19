'use client';

/**
 * The browser source itself.
 *
 * One alert is on screen at a time and the rest wait in a queue — two tips
 * arriving a second apart must not draw over each other. The sound is a pair of
 * oscillator notes rather than an audio file: no binary in the repository, no
 * licence question, and nothing to 404 in OBS.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AlertEvent } from '@tipvault/shared';

import './overlay.css';

/** How long a single alert stays up, including both animations. */
const VISIBLE_MS = 6_000;

interface Props {
  token: string;
  soundEnabled: boolean;
  ttsEnabled: boolean;
}

/** Minor units → display string. No floats: §4.4 applies on screen too. */
function formatUsdc(minor: string): string {
  const value = BigInt(minor || '0');
  const whole = value / 1_000_000n;
  const cents = (value % 1_000_000n) / 10_000n;
  return `$${whole}.${cents.toString().padStart(2, '0')}`;
}

function playChime(): void {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) {
      return;
    }
    const context = new AudioCtor();
    const now = context.currentTime;
    for (const [index, frequency] of [880, 1318.5].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.25, now + index * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.35);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + index * 0.12);
      oscillator.stop(now + index * 0.12 + 0.4);
    }
    setTimeout(() => void context.close(), 1200);
  } catch {
    // A browser source with audio disabled is not a reason to lose the alert.
  }
}

/** S10 replaces this with a real voice; until then it is deliberately visible in the log. */
function speak(alert: AlertEvent): void {
  console.log(`[tts stub] ${alert.nick}: ${alert.message}`);
}

export function AlertClient({ token, soundEnabled, ttsEnabled }: Props): React.ReactElement {
  const [current, setCurrent] = useState<AlertEvent | null>(null);
  const queue = useRef<AlertEvent[]>([]);
  const showing = useRef(false);
  const seen = useRef(new Set<string>());

  const drain = useCallback((): void => {
    if (showing.current) {
      return;
    }
    const next = queue.current.shift();
    if (!next) {
      return;
    }
    showing.current = true;
    setCurrent(next);
    if (soundEnabled) {
      playChime();
    }
    if (ttsEnabled) {
      speak(next);
    }
    setTimeout(() => {
      setCurrent(null);
      showing.current = false;
      drain();
    }, VISIBLE_MS);
  }, [soundEnabled, ttsEnabled]);

  useEffect(() => {
    const source = new EventSource(`/api/overlay/${token}/stream`);

    source.addEventListener('tip', (event: MessageEvent<string>) => {
      const alert = JSON.parse(event.data) as AlertEvent;
      // A reconnect replays what the browser had not acknowledged; the id keeps
      // the same tip from being shown twice.
      if (seen.current.has(alert.id)) {
        return;
      }
      seen.current.add(alert.id);
      queue.current.push(alert);
      drain();
    });

    return () => {
      source.close();
    };
  }, [token, drain]);

  if (!current) {
    return <div className="stage" aria-live="polite" />;
  }

  return (
    <div className="stage" aria-live="polite">
      <div className="card" key={current.id}>
        <div className="amount">{formatUsdc(current.amount)}</div>
        <div className="from">
          <span className="nick">{current.nick || 'anon'}</span> tipped
        </div>
        {current.message ? <div className="message">{current.message}</div> : null}
      </div>
    </div>
  );
}
