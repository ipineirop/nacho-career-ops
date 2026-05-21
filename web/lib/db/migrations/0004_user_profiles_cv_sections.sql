ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "summary_markdown" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "skills" text[];
