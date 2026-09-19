CREATE TABLE "alert_configs" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"overlay_token" text NOT NULL,
	"pack_id" text DEFAULT 'default' NOT NULL,
	"sound_enabled" boolean DEFAULT true NOT NULL,
	"tts_enabled" boolean DEFAULT false NOT NULL,
	"min_alert" numeric(20, 0) DEFAULT '1000000' NOT NULL,
	"rotated_at" timestamp with time zone,
	CONSTRAINT "alert_configs_overlay_token_unique" UNIQUE("overlay_token")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"creator_id" uuid,
	"login" text NOT NULL,
	"display_name" text NOT NULL,
	"mode" text NOT NULL,
	"recipient" text NOT NULL,
	"mint" text NOT NULL,
	"min_tip" numeric(20, 0) NOT NULL,
	"presets" numeric(20, 0)[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_login_unique" UNIQUE("login"),
	CONSTRAINT "channels_mode" CHECK ("channels"."mode" in ('direct', 'escrow'))
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"twitch_user_id" text,
	"login" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creators_twitch_user_id_unique" UNIQUE("twitch_user_id"),
	CONSTRAINT "creators_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "escrow_tips" (
	"channel_id" text NOT NULL,
	"tip_index" bigint NOT NULL,
	"donor" text NOT NULL,
	"amount" numeric(20, 0) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"settled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"channel_id" text,
	"signature" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"config" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tips" (
	"signature" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"amount" numeric(20, 0),
	"mint" text,
	"nick" text,
	"message" text,
	"status" text NOT NULL,
	"slot" bigint,
	"source" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"alerted_at" timestamp with time zone,
	CONSTRAINT "tips_status" CHECK ("tips"."status" in ('seen', 'confirmed', 'alerted')),
	CONSTRAINT "tips_source" CHECK ("tips"."source" in ('webhook', 'poll'))
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"address" text NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "wallets_creator_address" UNIQUE("creator_id","address")
);
--> statement-breakpoint
ALTER TABLE "alert_configs" ADD CONSTRAINT "alert_configs_channel_id_channels_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_channel_id_channels_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tips_channel_pending" ON "tips" USING btree ("channel_id","status") WHERE status = 'confirmed';