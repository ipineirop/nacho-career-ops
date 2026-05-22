-- Editorial verdict payload (verdict word, reasoning lede/body, comp strip,
-- gaps, legitimacy) produced by the modes-driven canonical evaluation.
-- Persisted so the live editorial verdict can later be re-rendered on the
-- saved report page. Apply manually to Supabase (drizzle-kit generate is broken
-- in this repo).
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS verdict_payload jsonb;
