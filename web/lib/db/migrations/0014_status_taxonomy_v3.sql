-- Status taxonomy migration: 8 codes → 9 canonical DS §11 codes.
--
-- The wiring doc (`web/Design/Labra Tracker - wiring.md`) and DS bilingual
-- update §11 lock the canonical status set:
--
--   active     evaluating | applied | interviewing | offer_pending
--   terminal   offer_accepted | rejected | withdrew | passed | ghosted
--
-- Three values rename (offer→offer_pending, accepted→offer_accepted,
-- withdrawn→withdrew) and ghosted is new (no backfill — no prior rows
-- carry that value). The status column stays `text` (not a pg enum) so we
-- enforce membership with a CHECK constraint, matching the existing
-- migration style in this repo.
--
-- Outcome enum (`outcomes.outcome_type`) is a separate concern (it tracks
-- the captured offer/rejection/ghost record, not the pipeline state) and
-- is NOT migrated here. The wiring doc keeps `ghost` as the outcome code
-- to avoid a redundant rename that adds no clarity.
--
-- Idempotent: re-running on already-migrated data is a no-op.

-- 1. Rename existing codes to the v3 taxonomy.
UPDATE pipeline_status SET status = 'offer_pending'   WHERE status = 'offer';
UPDATE pipeline_status SET status = 'offer_accepted'  WHERE status = 'accepted';
UPDATE pipeline_status SET status = 'withdrew'        WHERE status = 'withdrawn';

-- 2. Enforce membership in the v3 set.
-- Drop the old constraint if a prior one existed (named or unnamed) before
-- adding the new check.
ALTER TABLE pipeline_status DROP CONSTRAINT IF EXISTS pipeline_status_status_check;

ALTER TABLE pipeline_status
  ADD CONSTRAINT pipeline_status_status_check
  CHECK (status IN (
    'evaluating',
    'applied',
    'interviewing',
    'offer_pending',
    'offer_accepted',
    'rejected',
    'withdrew',
    'passed',
    'ghosted'
  ));

-- 3. Active-only Tracker toggle: persisted per user so the choice syncs
-- across devices. Default false matches the v0.2 mockup behavior (active
-- + closed-30d soft-divided below).
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS tracker_active_only boolean NOT NULL DEFAULT false;
