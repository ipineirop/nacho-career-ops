CREATE TABLE "signin_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "signin_codes_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "signin_codes_email_idx" ON "signin_codes" USING btree ("email");
