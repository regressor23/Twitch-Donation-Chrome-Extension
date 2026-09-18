import { defineConfig } from 'vitest/config';

/**
 * Program tests need a running validator, so they are deliberately kept out of
 * the root `pnpm test` and run only through `anchor test`, which starts one.
 *
 * Everything runs in a single process, in order: the scenarios share one
 * validator, one mint and one donor token account, and parallel workers would
 * race each other over balances and nonces.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
  },
});
