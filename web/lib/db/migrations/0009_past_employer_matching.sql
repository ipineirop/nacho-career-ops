-- Phase A: Don't-Want Capture & Past-Employer Matching (backend).
-- Hand-written (drizzle-kit generate is broken in this repo); apply manually to Supabase.

-- Past-employer canonical resolution lives on the authoritative career-history rows
-- (chosen over a denormalized user_profiles.past_employers jsonb to avoid drift).
ALTER TABLE "user_career_history" ADD COLUMN IF NOT EXISTS "canonical_id" text;--> statement-breakpoint
ALTER TABLE "user_career_history" ADD COLUMN IF NOT EXISTS "match_status" text;--> statement-breakpoint

-- §1.2 surface toggle (UI in Phase B) + §5.1 per-user match suppressions.
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "past_employer_surface_on_match" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "match_suppressions" jsonb;--> statement-breakpoint

-- §2.3 match record, persisted so the verdict renders correctly on revisit.
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "past_employer_match" jsonb;
