-- Add a country to each student profile for international university discovery.
-- Existing Nigerian state records remain assigned to Nigeria; legacy outside-Nigeria
-- records are left blank so those students can choose their actual country on next edit.
ALTER TABLE student_profiles ADD COLUMN country TEXT NOT NULL DEFAULT 'Nigeria';
UPDATE student_profiles SET country = '' WHERE state LIKE 'Outside Nigeria%';
