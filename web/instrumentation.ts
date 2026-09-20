/**
 * Starts the fallback poller when the server process starts.
 *
 * §10 asks for a sweep every 30 seconds, and an endpoint nobody calls is not a
 * fallback — it is a button. A long-lived process can simply hold the timer
 * itself, which is the concrete reason this is hosted on Railway rather than on
 * serverless functions (CLAUDE.md §6).
 *
 * The interval has its default here, in code, not only in `.env.example`: this
 * is the protection against a missed webhook, and it must not switch itself off
 * because someone copied an incomplete `.env`. Only an explicit `0` turns the
 * timer off, and that is how the "the webhook never arrived" test isolates the
 * two paths.
 */

/** Sweep period when `POLL_INTERVAL_MS` says nothing usable (CLAUDE.md §10). */
const DEFAULT_INTERVAL_MS = 30_000;

/**
 * Resolves the sweep period and says out loud which branch it took, so a
 * surprising interval in production is one log line away from being explained.
 */
function resolveInterval(): number {
  const configured = process.env.POLL_INTERVAL_MS;

  if (configured === undefined || configured.trim() === '') {
    console.log(
      `[poll] POLL_INTERVAL_MS is not set, using the built-in default ${DEFAULT_INTERVAL_MS} ms`,
    );
    return DEFAULT_INTERVAL_MS;
  }

  const parsed = Number(configured);
  if (parsed === 0) {
    // Explicit and deliberate: the only way to run without the fallback.
    return 0;
  }
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.warn(
      `[poll] POLL_INTERVAL_MS is ${JSON.stringify(configured)}, which is not a usable interval; ` +
        `falling back to ${DEFAULT_INTERVAL_MS} ms rather than leaving tips undelivered`,
    );
    return DEFAULT_INTERVAL_MS;
  }
  return parsed;
}

export async function register(): Promise<void> {
  // The edge runtime has no timers worth the name and no database driver.
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const interval = resolveInterval();
  if (interval === 0) {
    console.log('[poll] scheduled sweep disabled by POLL_INTERVAL_MS=0');
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
