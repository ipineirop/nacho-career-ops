-- Post-onboarding teaching moment: the coach mark + FAB pulse appear on the
-- first visit to the empty Tracker and dismiss permanently on the first FAB
-- tap. This boolean is the sticky dismissal flag. Existing users default to
-- false; combined with their existing evaluations, isFirstEvalVisit() will
-- correctly skip the teaching moment for them.
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS coach_mark_dismissed boolean NOT NULL DEFAULT false;
