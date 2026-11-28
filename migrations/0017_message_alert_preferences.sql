-- Enable new private-message alerts for every existing and future account.
-- Users can opt out at any time from Account Settings.
ALTER TABLE student_profiles
  ADD COLUMN message_alerts_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (message_alerts_enabled IN (0, 1));
