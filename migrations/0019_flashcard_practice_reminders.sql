-- Daily flashcard practice reminders, scheduled in each student's local timezone.
ALTER TABLE student_profiles ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'Africa/Lagos';
ALTER TABLE student_profiles ADD COLUMN flashcard_reminders_enabled INTEGER NOT NULL DEFAULT 1 CHECK (flashcard_reminders_enabled IN (0, 1));
ALTER TABLE student_profiles ADD COLUMN flashcard_reminder_next_at INTEGER;
ALTER TABLE student_profiles ADD COLUMN flashcard_reminder_sent_on TEXT;

CREATE INDEX IF NOT EXISTS idx_student_profiles_flashcard_reminder_due
ON student_profiles(flashcard_reminders_enabled, flashcard_reminder_next_at);
