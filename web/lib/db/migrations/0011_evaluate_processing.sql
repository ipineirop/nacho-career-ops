-- Evaluate spec (FAB + panel + /evaluate/[id]) processing columns.
-- The new flow inserts an evaluations row immediately on user submit and fills
-- the rest in the background, so role_id must be nullable.
-- Apply manually to Supabase (drizzle-kit generate is broken in this repo).

-- Add the new columns. status backfills to 'complete' on existing rows so they
-- aren't surfaced as still-processing.
ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS status                    text NOT NULL DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS input_type                text,
  ADD COLUMN IF NOT EXISTS classification_confidence real,
  ADD COLUMN IF NOT EXISTS raw_input                 text,
  ADD COLUMN IF NOT EXISTS verdict                   text;

-- New evaluations should start as 'processing' (existing rows already backfilled).
ALTER TABLE evaluations ALTER COLUMN status SET DEFAULT 'processing';

-- Role is extracted in the background after the row is created.
ALTER TABLE evaluations ALTER COLUMN role_id DROP NOT NULL;

-- Backfill the top-level verdict from verdict_payload for legacy rows.
UPDATE evaluations
   SET verdict = verdict_payload->>'verdict'
 WHERE verdict IS NULL
   AND verdict_payload IS NOT NULL
   AND verdict_payload->>'verdict' IN ('reply', 'pursue', 'watch', 'skip');

-- Lightweight index for processing-state lookups by user.
CREATE INDEX IF NOT EXISTS evaluations_user_status_idx ON evaluations (user_id, status);
