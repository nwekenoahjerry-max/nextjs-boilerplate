-- Daily active foreground time in the ClerkME workspace.
-- One row per student and Lagos calendar day; excludes hidden/idle periods.
CREATE TABLE IF NOT EXISTS student_learning_time (
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  activity_date TEXT NOT NULL,
  active_seconds INTEGER NOT NULL DEFAULT 0 CHECK (active_seconds >= 0 AND active_seconds <= 86400),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, activity_date)
);
CREATE INDEX IF NOT EXISTS idx_student_learning_time_date
  ON student_learning_time(user_id, activity_date DESC);
