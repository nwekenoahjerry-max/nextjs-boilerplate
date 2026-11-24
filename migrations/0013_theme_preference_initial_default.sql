-- Light is the first-use appearance for new accounts.
-- Preserve every existing account's stored preference, including System.
ALTER TABLE student_profiles
  ADD COLUMN theme_preference_explicit INTEGER NOT NULL DEFAULT 0
  CHECK (theme_preference_explicit IN (0, 1));
UPDATE student_profiles SET theme_preference_explicit = 1;
