ALTER TABLE "opportunities" ADD COLUMN "scale" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;