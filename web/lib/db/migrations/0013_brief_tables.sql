-- Labra Brief — daily editorial surface tables.
-- Two new tables back the /brief route: brief_cache stores the resolved daily
-- payload (so the LLM editor's-note generation runs at most once per user per
-- user-local day), and signal_states persists per-signal snooze/dismiss
-- decisions across renders.
-- Apply manually to Supabase (drizzle-kit generate is broken in this repo).

-- brief_cache — resolved §3 Brief payload per user per user-local day.
-- payload is the full §3-shape JSON the API returns. expires_at is set to
-- user-local midnight; reads beyond it regenerate. Unique on (user_id,
-- iso_date) so a day can have exactly one cached payload per user.
CREATE TABLE IF NOT EXISTS brief_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  iso_date     date NOT NULL,
  payload      jsonb NOT NULL,
  generated_at timestamp DEFAULT now(),
  expires_at   timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS brief_cache_user_date_uniq
  ON brief_cache (user_id, iso_date);

CREATE INDEX IF NOT EXISTS brief_cache_user_idx
  ON brief_cache (user_id, iso_date);

-- signal_states — snooze + dismiss persistence per signal occurrence.
-- entity_ref is the natural occurrence key:
--   freshness     → 'field:comp_floor' | 'field:story_bank' | 'field:archetypes'
--   drift         → 'field:seniority' | 'field:function' | ...
--   bar           → 'company:<name>' (unused in v1; bar signal returns [])
--   pipeline.cold → 'role:<roleId>'
--   pipeline.next → 'role:<roleId>'
-- A specific occurrence is uniquely identified by (user_id, signal_type,
-- entity_ref). Snoozing sets snoozed_until; dismissing sets dismissed_at and
-- suppresses that occurrence permanently. New triggers of the same type with
-- a different entity_ref get fresh state.
CREATE TABLE IF NOT EXISTS signal_states (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_type   text NOT NULL,
  entity_ref    text NOT NULL,
  snoozed_until timestamp,
  dismissed_at  timestamp,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS signal_states_user_type_ref_uniq
  ON signal_states (user_id, signal_type, entity_ref);

CREATE INDEX IF NOT EXISTS signal_states_user_idx
  ON signal_states (user_id);

-- Observation logs for handoff §6.5 reuse the existing user_events table with
-- event types brief.signal_rendered, brief.signal_action, brief.generation_cost.
-- No schema change needed there.
