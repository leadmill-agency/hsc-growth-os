CREATE TABLE "outreach_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"contact_id" uuid,
	"segment" text NOT NULL,
	"market" text NOT NULL,
	"email" text NOT NULL,
	"apollo_person_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"stop_reason" text,
	"last_step_sent" integer DEFAULT 0 NOT NULL,
	"first_sent_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone,
	"thread_subject" text,
	"thread_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_enrollments_apollo_person_id_unique" UNIQUE("apollo_person_id")
);
--> statement-breakpoint
ALTER TABLE "outreach_enrollments" ADD CONSTRAINT "outreach_enrollments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_enrollments" ADD CONSTRAINT "outreach_enrollments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_enrollments" ENABLE ROW LEVEL SECURITY;
