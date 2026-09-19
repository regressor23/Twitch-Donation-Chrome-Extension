import { defineConfig } from 'drizzle-kit';

import { loadLocalEnv } from './lib/env';

// drizzle-kit runs outside Next, so nothing has read .env.local yet.
loadLocalEnv();

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
