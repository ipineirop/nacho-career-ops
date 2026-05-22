CREATE TABLE IF NOT EXISTS "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text,
	"url" text UNIQUE,
	"company" text,
	"role" text,
	"portal" text,
	"first_seen" text,
	"status" text,
	"created_at" timestamp DEFAULT now()
);
