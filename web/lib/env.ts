/**
 * Server-side environment, validated once and loudly.
 *
 * A missing secret has to fail with the name of the variable, not with
 * `undefined` three layers down inside a database driver. Nothing here is ever
 * imported from a client component: these values stay on the server (§4.8).
 */
import { z } from 'zod';

/** base58, 32 bytes — good enough to catch a truncated paste, not a checksum. */
const base58Address = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'not a base58 address');

const schema = z.object({
  DATABASE_URL: z.url(),
  /** Private RPC. The browser gets NEXT_PUBLIC_RPC_URL instead, never this. */
  RPC_URL_PRIVATE: z.url(),
  USDC_MINT: base58Address,
  /** Shared secret Helius echoes back in the Authorization header. */
  HELIUS_WEBHOOK_SECRET: z.string().min(32),
  /** Guards POST /api/internal/poll, which is otherwise a free RPC bill. */
  INTERNAL_TASK_SECRET: z.string().min(32),
  /** Signs the session cookie, the OAuth state and the wallet challenge. */
  SESSION_SECRET: z.string().min(32),
  /** Only the registration script needs this one. */
  HELIUS_API_KEY: z.string().min(1).optional(),
});

/**
 * The signing key on its own.
 *
 * `env()` validates the whole contract and is the right thing for a request
 * handler, but the signing helpers in lib/session.ts are pure crypto with one
 * input, and making them depend on a database URL would mean they could not be
 * tested without one. It stays in the schema above as well, so a deployment
 * still refuses to boot without it.
 */
export function sessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error('SESSION_SECRET is missing or shorter than 32 characters');
  }
  return value;
}

/**
 * Twitch credentials, validated separately and on demand.
 *
 * They are part of the §5.5 contract, but they are deliberately not in the
 * schema above: a deployment that only serves overlays must keep serving them
 * when nobody has registered a Twitch application yet. Asking here means the
 * failure lands on the sign-in route, naming what is missing, instead of
 * taking the whole server down at boot.
 */
const twitchSchema = z.object({
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),
  TWITCH_REDIRECT_URI: z.url(),
});

export type TwitchConfig = z.infer<typeof twitchSchema>;

export function twitchConfig(): TwitchConfig {
  const parsed = twitchSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(
      `Twitch sign-in is not configured: ${missing}. ` +
        'Register an application at https://dev.twitch.tv/console/apps and set them.',
    );
  }
  return parsed.data;
}

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/**
 * Reads `.env.local` into `process.env` for code that runs outside Next.js —
 * drizzle-kit and the scripts. Next loads it on its own, and re-reading is a
 * no-op there because existing values win.
 */
export function loadLocalEnv(file = '.env.local'): void {
  try {
    process.loadEnvFile(file);
  } catch {
    // Already loaded by Next, or genuinely absent: env() reports what is missing.
  }
}

export function env(): Env {
  if (cached) {
    return cached;
  }
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n  ');
    throw new Error(`environment is not usable:\n  ${missing}`);
  }
  cached = parsed.data;
  return cached;
}
