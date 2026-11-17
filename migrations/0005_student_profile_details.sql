-- Extend the student profile with career direction and local geography.
-- Existing account rows remain intact; new columns start empty until the student completes the profile.
ALTER TABLE student_profiles ADD COLUMN future_specialty TEXT NOT NULL DEFAULT '';
ALTER TABLE student_profiles ADD COLUMN state TEXT NOT NULL DEFAULT '';
ALTER TABLE student_profiles ADD COLUMN lga TEXT NOT NULL DEFAULT '';
