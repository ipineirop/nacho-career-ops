-- Row Level Security (RLS) Policies
-- These policies ensure users can only access their own data
-- Run this after initial schema migration on Supabase

-- Enable RLS on all user-owned tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_signals_derived ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_career_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_proof_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Global tables (no RLS needed)
-- - companies: read by all users
-- - roles: read by all users
-- - market_signals: read by all users

-- ============================================================
-- users table
-- ============================================================
CREATE POLICY "Users can read own user record"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own user record"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- user_profiles table
-- ============================================================
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- user_locations table
-- ============================================================
CREATE POLICY "Users can read own locations"
  ON user_locations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own locations"
  ON user_locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own locations"
  ON user_locations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- user_preferences table
-- ============================================================
CREATE POLICY "Users can read own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- user_compensation table
-- ============================================================
CREATE POLICY "Users can read own compensation"
  ON user_compensation FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own compensation"
  ON user_compensation FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own compensation"
  ON user_compensation FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- user_signals_derived table
-- ============================================================
CREATE POLICY "Users can read own derived signals"
  ON user_signals_derived FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own derived signals"
  ON user_signals_derived FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own derived signals"
  ON user_signals_derived FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- user_events table
-- ============================================================
CREATE POLICY "Users can read own events"
  ON user_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
  ON user_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- user_career_history table
-- ============================================================
CREATE POLICY "Users can read own career history"
  ON user_career_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own career history"
  ON user_career_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own career history"
  ON user_career_history FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- evaluations table
-- ============================================================
CREATE POLICY "Users can read own evaluations"
  ON evaluations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own evaluations"
  ON evaluations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own evaluations"
  ON evaluations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- evaluation_dimensions table
-- Cascades from evaluations via FK
-- ============================================================
CREATE POLICY "Users can read dimensions of own evaluations"
  ON evaluation_dimensions FOR SELECT
  USING (
    evaluation_id IN (
      SELECT id FROM evaluations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert dimensions to own evaluations"
  ON evaluation_dimensions FOR INSERT
  WITH CHECK (
    evaluation_id IN (
      SELECT id FROM evaluations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update dimensions of own evaluations"
  ON evaluation_dimensions FOR UPDATE
  USING (
    evaluation_id IN (
      SELECT id FROM evaluations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    evaluation_id IN (
      SELECT id FROM evaluations WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- evaluation_gaps table
-- Cascades from evaluations via FK
-- ============================================================
CREATE POLICY "Users can read gaps of own evaluations"
  ON evaluation_gaps FOR SELECT
  USING (
    evaluation_id IN (
      SELECT id FROM evaluations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert gaps to own evaluations"
  ON evaluation_gaps FOR INSERT
  WITH CHECK (
    evaluation_id IN (
      SELECT id FROM evaluations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update gaps of own evaluations"
  ON evaluation_gaps FOR UPDATE
  USING (
    evaluation_id IN (
      SELECT id FROM evaluations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    evaluation_id IN (
      SELECT id FROM evaluations WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- evaluation_proof_points table
-- Cascades from evaluations via FK
-- ============================================================
CREATE POLICY "Users can read proof points of own evaluations"
  ON evaluation_proof_points FOR SELECT
  USING (
    evaluation_id IN (
      SELECT id FROM evaluations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert proof points to own evaluations"
  ON evaluation_proof_points FOR INSERT
  WITH CHECK (
    evaluation_id IN (
      SELECT id FROM evaluations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update proof points of own evaluations"
  ON evaluation_proof_points FOR UPDATE
  USING (
    evaluation_id IN (
      SELECT id FROM evaluations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    evaluation_id IN (
      SELECT id FROM evaluations WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- pipeline_status table
-- ============================================================
CREATE POLICY "Users can read own pipeline status"
  ON pipeline_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pipeline status"
  ON pipeline_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pipeline status"
  ON pipeline_status FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- interactions table
-- ============================================================
CREATE POLICY "Users can read own interactions"
  ON interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interactions"
  ON interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interactions"
  ON interactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- outcomes table
-- ============================================================
CREATE POLICY "Users can read own outcomes"
  ON outcomes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outcomes"
  ON outcomes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outcomes"
  ON outcomes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- journal_entries table
-- ============================================================
CREATE POLICY "Users can read own journal entries"
  ON journal_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
  ON journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries"
  ON journal_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- documents table
-- ============================================================
CREATE POLICY "Users can read own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- star_stories table
-- ============================================================
CREATE POLICY "Users can read own stories"
  ON star_stories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stories"
  ON star_stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stories"
  ON star_stories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- oauth_tokens table
-- ============================================================
CREATE POLICY "Users can read own oauth tokens"
  ON oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own oauth tokens"
  ON oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own oauth tokens"
  ON oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
-- Ensure public schema is accessible
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
