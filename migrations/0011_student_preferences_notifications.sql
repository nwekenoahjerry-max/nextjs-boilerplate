-- Per-student appearance preferences and private in-app notifications.
ALTER TABLE student_profiles
  ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'system'
  CHECK (theme_preference IN ('light', 'dark', 'system'));
CREATE TABLE IF NOT EXISTS student_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT 'study'
    CHECK (destination IN ('materials', 'qbank', 'study', 'you')),
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_student_notifications_user_created ON student_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_notifications_user_unread ON student_notifications(user_id, is_read, created_at DESC);
