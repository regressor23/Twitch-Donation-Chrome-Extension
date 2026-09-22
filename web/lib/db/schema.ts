/**
 * Database schema (CLAUDE.md §5.4), accepted by the reviewer before S3 started.
 * Changing it needs a separate approval.
 *
 * Amounts are `numeric(20, 0)`, not `bigint`: a Solana `u64` runs past the top
 * of Postgres's signed `bigint`, and §4.4 forbids trading that for a float. The
 * driver hands `numeric` back as a string, which the app turns into a `bigint`.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/** u64 minor units. See the note at the top of the file. */
const amount = (name: string) => numeric(name, { precision: 20, scale: 0 });
const tstz = (name: string) => timestamp(name, { withTimezone: true });

export const creators = pgTable('creators', {
  id: uuid('id').primaryKey().defaultRandom(),
  twitchUserId: text('twitch_user_id').unique(),
  login: text('login').notNull().unique(),
  displayName: text('display_name').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
});

export const channels = pgTable(
  'channels',
  {
    /** Numeric Twitch user id, exactly as it appears in the memo. */
    channelId: text('channel_id').primaryKey(),
    creatorId: uuid('creator_id').references(() => creators.id),
    login: text('login').notNull().unique(),
    displayName: text('display_name').notNull(),
    mode: text('mode').notNull(),
    /** Owner wallet for `direct`, escrow PDA for `escrow`. */
    recipient: text('recipient').notNull(),
    mint: text('mint').notNull(),
    minTip: amount('min_tip').notNull(),
    presets: amount('presets')
      .array()
      .notNull()
      .default(sql`'{}'`),
    /** Only active channels are walked by the fallback poller. */
    active: boolean('active').notNull().default(true),
    createdAt: tstz('created_at').notNull().defaultNow(),
  },
  (table) => [check('channels_mode', sql`${table.mode} in ('direct', 'escrow')`)],
);

export const wallets = pgTable(
  'wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => creators.id),
    address: text('address').notNull(),
    verifiedAt: tstz('verified_at'),
  },
  (table) => [unique('wallets_creator_address').on(table.creatorId, table.address)],
);

/**
 * One tip. `signature` is the primary key, so idempotency is a property of the
 * table rather than an agreement between callers — the same reasoning that kept
 * `init` on the nonce PDA in the program (docs/security.md).
 *
 * `amount`/`mint`/`nick`/`message` stay null while the status is `seen`, which
 * means "a trigger saw this signature but the RPC has not returned the
 * transaction yet". Nothing is written at all for a transfer of some other
 * mint: the alert layer never learns such a transaction existed.
 */
export const tips = pgTable(
  'tips',
  {
    signature: text('signature').primaryKey(),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.channelId),
    amount: amount('amount'),
    mint: text('mint'),
    nick: text('nick'),
    message: text('message'),
    status: text('status').notNull(),
    slot: bigint('slot', { mode: 'number' }),
    /** Which trigger got here first. Without it, "the poller caught it" is a claim. */
    source: text('source').notNull(),
    seenAt: tstz('seen_at').notNull().defaultNow(),
    confirmedAt: tstz('confirmed_at'),
    alertedAt: tstz('alerted_at'),
  },
  (table) => [
    check('tips_status', sql`${table.status} in ('seen', 'confirmed', 'alerted')`),
    check('tips_source', sql`${table.source} in ('webhook', 'poll')`),
    index('tips_channel_pending')
      .on(table.channelId, table.status)
      .where(sql`status = 'confirmed'`),
  ],
);

/**
 * One escrow tip, identified exactly the way the program identifies it.
 *
 * `(channel_id, tip_index)` is unique because that pair *is* the tip on chain:
 * without the constraint a webhook retry and a poller sweep that see the same
 * `tip_escrow` transaction would each insert a row, and the claim flow would
 * later disagree with the chain about how much is owed.
 */
export const escrowTips = pgTable(
  'escrow_tips',
  {
    channelId: text('channel_id').notNull(),
    tipIndex: bigint('tip_index', { mode: 'bigint' }).notNull(),
    donor: text('donor').notNull(),
    amount: amount('amount').notNull(),
    expiresAt: tstz('expires_at').notNull(),
    settled: boolean('settled').notNull().default(false),
  },
  (table) => [unique('escrow_tips_channel_index').on(table.channelId, table.tipIndex)],
);

/**
 * Every attestation nonce this service has ever issued.
 *
 * The nonce is the primary key, so "never issued twice" is a property of the
 * table rather than a promise in a code comment — the same reasoning that kept
 * `init` on the on-chain nonce PDA (docs/security.md §1) and that makes a
 * repeated webhook harmless (`tips.signature`).
 *
 * The constraint here is deliberately stricter than the chain's. On chain the
 * nonce PDA is seeded `[b"nonce", channel_id, nonce]`, so the same number may
 * legitimately exist for two different channels. We never need that, and a
 * global key cannot fail in the direction of issuing a nonce twice.
 */
export const attestationNonces = pgTable('attestation_nonces', {
  /** u64, random. See the note above for why this is the primary key. */
  nonce: amount('nonce').primaryKey(),
  channelId: text('channel_id')
    .notNull()
    .references(() => channels.channelId),
  /** Who asked for it — an attestation is issued to a signed-in creator. */
  creatorId: uuid('creator_id').references(() => creators.id),
  issuedAt: tstz('issued_at').notNull().defaultNow(),
  /** Filled once the matching `claim` is seen on chain; null means unspent. */
  claimSignature: text('claim_signature'),
});

export const alertConfigs = pgTable('alert_configs', {
  channelId: text('channel_id')
    .primaryKey()
    .references(() => channels.channelId),
  /** 32 random bytes, base64url. Never logged (CLAUDE.md §5.3). */
  overlayToken: text('overlay_token').notNull().unique(),
  packId: text('pack_id').notNull().default('default'),
  soundEnabled: boolean('sound_enabled').notNull().default(true),
  ttsEnabled: boolean('tts_enabled').notNull().default(false),
  minAlert: amount('min_alert').notNull().default('1000000'),
  rotatedAt: tstz('rotated_at'),
});

export const packs = pgTable('packs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  config: jsonb('config').notNull(),
});

/** Audit trail. Deliberately never written for a non-USDC transfer. */
export const events = pgTable('events', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  kind: text('kind').notNull(),
  channelId: text('channel_id'),
  signature: text('signature'),
  payload: jsonb('payload').notNull(),
  createdAt: tstz('created_at').notNull().defaultNow(),
});
