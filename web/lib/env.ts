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
  /** Only the registration script needs this one. */
  HELIUS_API_KEY: z.string().min(1).optional(),
});

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
