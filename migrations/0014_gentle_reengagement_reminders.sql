-- Track the most recent authenticated visit and per-channel reminder delivery.
ALTER TABLE student_profiles ADD COLUMN last_seen_at INTEGER;
ALTER TABLE student_profiles ADD COLUMN email_reminders_enabled INTEGER NOT NULL DEFAULT 1 CHECK (email_reminders_enabled IN (0, 1));
ALTER TABLE student_profiles ADD COLUMN email_reminder_sent_at INTEGER;
ALTER TABLE student_profiles ADD COLUMN push_reminder_sent_at INTEGER;

-- Existing accounts have no trustworthy last-visit timestamp in the previous schema.
-- Give them a full 48-hour grace period from activation instead of guessing from signup date.
UPDATE student_profiles SET last_seen_at = unixepoch() WHERE last_seen_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_student_profiles_reengagement ON student_profiles(email_reminders_enabled, last_seen_at, email_reminder_sent_at, push_reminder_sent_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_success_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
