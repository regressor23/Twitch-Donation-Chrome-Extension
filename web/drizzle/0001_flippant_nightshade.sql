CREATE TABLE "attestation_nonces" (
	"nonce" numeric(20, 0) PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"creator_id" uuid,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claim_signature" text
);
--> statement-breakpoint
ALTER TABLE "attestation_nonces" ADD CONSTRAINT "attestation_nonces_channel_id_channels_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestation_nonces" ADD CONSTRAINT "attestation_nonces_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_tips" ADD CONSTRAINT "escrow_tips_channel_index" UNIQUE("channel_id","tip_index");