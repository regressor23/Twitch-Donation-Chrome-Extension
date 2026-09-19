/**
 * Starts the fallback poller when the server process starts.
 *
 * §10 asks for a sweep every 30 seconds, and an endpoint nobody calls is not a
 * fallback — it is a button. A long-lived process can simply hold the timer
 * itself, which is the concrete reason this is hosted on Railway rather than on
 * serverless functions (CLAUDE.md §6).
 *
 * Set `POLL_INTERVAL_MS=0` to leave the timer off; that is how the "the webhook
 * never arrived" test proves the two paths independently.
 */
export async function register(): Promise<void> {
  // The edge runtime has no timers worth the name and no database driver.
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const interval = Number(process.env.POLL_INTERVAL_MS ?? 30_000);
  if (!Number.isFinite(interval) || interval <= 0) {
    console.log('[poll] scheduled sweep disabled');
    return;
  }

  const { sweep } = await import('./lib/poll');

  // A sweep that outlives its slot must not overlap the next one: the RPC is
  // rate limited and a pile-up turns one slow call into an outage.
  let running = false;
  const timer = setInterval(() => {
    if (running) {
      console.warn('[poll] previous sweep still running, skipping this slot');
      return;
    }
    running = true;
    sweep()
      .catch((error: unknown) => {
        // A failed sweep is a missed fallback, never a dead server.
        console.error('[poll] sweep failed', error);
      })
      .finally(() => {
        running = false;
      });
  }, interval);

  // Node keeps the process alive for a pending timer; the server does not need
  // that, and an unref'd timer lets a shutdown actually finish.
  timer.unref();
  console.log(`[poll] scheduled sweep every ${interval} ms`);
}
