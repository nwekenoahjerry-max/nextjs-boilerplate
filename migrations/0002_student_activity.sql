-- Student learning streaks: one activity record per account per Lagos calendar day.
CREATE TABLE IF NOT EXISTS student_activity_days (
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  activity_date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, activity_date)
);
CREATE INDEX IF NOT EXISTS idx_student_activity_date ON student_activity_days(user_id, activity_date DESC);
