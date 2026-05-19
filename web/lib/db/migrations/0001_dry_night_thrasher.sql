CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"created_by" uuid NOT NULL,
	"claimed_by" uuid,
	"expires_at" timestamp NOT NULL,
	"claimed_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "invitations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitations_code_idx" ON "invitations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "invitations_created_by_idx" ON "invitations" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "invitations_claimed_by_idx" ON "invitations" USING btree ("claimed_by");