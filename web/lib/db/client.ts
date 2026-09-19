/**
 * One Postgres pool per process.
 *
 * Next's dev server re-evaluates modules on every edit, so the pool is parked
 * on `globalThis`; without that, an afternoon of hot reloads ends with the
 * connection limit reached and an error that looks like a database outage.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env, loadLocalEnv } from '../env';
import * as schema from './schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

const holder = globalThis as unknown as { __tipvaultDb?: Db; __tipvaultSql?: postgres.Sql };

export function db(): Db {
  if (holder.__tipvaultDb) {
    return holder.__tipvaultDb;
  }
  loadLocalEnv();
  const sql = postgres(env().DATABASE_URL, {
    max: 5,
    // Amounts come back as strings; the app turns them into bigint itself.
    types: {},
    onnotice: () => {},
  });
  holder.__tipvaultSql = sql;
  holder.__tipvaultDb = drizzle(sql, { schema });
  return holder.__tipvaultDb;
}

/** Closes the pool. Used by scripts and tests, never by a request handler. */
export async function closeDb(): Promise<void> {
  await holder.__tipvaultSql?.end({ timeout: 5 });
  holder.__tipvaultSql = undefined;
  holder.__tipvaultDb = undefined;
}
