-- Email/password authentication for ClerkME.
-- Existing users were created through Google sign-in, which already requires a verified Google email.
ALTER TABLE student_profiles ADD COLUMN email_verified_at INTEGER;

UPDATE student_profiles
SET email_verified_at = unixepoch()
WHERE email_verified_at IS NULL
  AND EXISTS (
    SELECT 1 FROM google_identities
    WHERE google_identities.user_id = student_profiles.id
  );

CREATE TABLE IF NOT EXISTS email_action_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'password_reset')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_email_action_tokens_user_purpose
ON email_action_tokens(user_id, purpose, expires_at);

CREATE INDEX IF NOT EXISTS idx_student_profiles_verified_email
ON student_profiles(email, email_verified_at);
