/**
 * The alert stream itself, shared by both ways of reaching it.
 *
 * Two routes resolve an overlay: `/api/overlay/stream` from the cookie, which
 * is what a browser source uses, and `/api/overlay/[token]/stream` from the
 * path, which is what the measurement scripts use. They must produce a
 * byte-identical stream — the moment they diverge, the latency number comes
 * from code the streamer never runs.
 *
 * SSE rather than a socket because the traffic is one-way and a browser source
 * that loses the connection reconnects on its own. What it missed while it was
 * gone is not lost either: on connect the stream first drains the tips that are
 * still `confirmed`, then follows the live feed.
 */
import type { AlertEvent } from '@tipvault/shared';

import { markAlerted, pendingAlerts, subscribe } from './alerts';
import type { OverlayTarget } from './overlay';

/** Long enough to be cheap, short enough to beat an idle proxy timeout. */
const HEARTBEAT_MS = 15_000;

export function alertStream(target: OverlayTarget, requestSignal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const { channelId, minAlert } = target;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;

      const send = (alert: AlertEvent): void => {
        if (!open || BigInt(alert.amount) < minAlert) {
          return;
        }
        controller.enqueue(
          encoder.encode(`id: ${alert.id}\nevent: tip\ndata: ${JSON.stringify(alert)}\n\n`),
        );
        void markAlerted(alert.signature);
      };

      // Tell the browser how soon to come back, and open the stream with a
      // comment so proxies flush headers immediately.
      controller.enqueue(encoder.encode('retry: 2000\n: connected\n\n'));

      for (const alert of await pendingAlerts(channelId)) {
        send(alert);
      }

      const unsubscribe = subscribe(channelId, send);
      const heartbeat = setInterval(() => {
        if (open) {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        }
      }, HEARTBEAT_MS);

      const close = (): void => {
        if (!open) {
          return;
        }
        open = false;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the runtime when the client vanished.
        }
      };

      requestSignal.addEventListener('abort', close);
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // nginx and friends buffer text/event-stream unless told not to.
      'x-accel-buffering': 'no',
    },
  });
}
