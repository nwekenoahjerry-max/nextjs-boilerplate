-- Modern account/session schema for ClerkMe.
-- Preserve the existing legacy users, google_accounts, sessions and payments tables.
-- Map existing user and Google identity records forward without deleting legacy data.
CREATE TABLE IF NOT EXISTS student_profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  school TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'Clinical year 1',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS google_identities (
  google_sub TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES student_profiles(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket_hash TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL
);

-- Migrate existing account profiles when the legacy ClerkMe schema is present.
INSERT OR IGNORE INTO student_profiles
  (id, email, password_salt, password_hash, full_name, school, level, created_at, updated_at)
SELECT CAST(id AS TEXT), email, salt, pw, COALESCE(name, 'ClerkMe user'),
       COALESCE(school, ''), COALESCE(level, 'Clinical year 1'),
       COALESCE(created, unixepoch()), unixepoch()
FROM users
WHERE email IS NOT NULL AND salt IS NOT NULL AND pw IS NOT NULL;

-- Preserve Google sign-in links so current users can continue using their accounts.
INSERT OR IGNORE INTO google_identities (google_sub, user_id, created_at)
SELECT ga.sub, CAST(ga.uid AS TEXT), COALESCE(ga.created, unixepoch())
FROM google_accounts ga
JOIN student_profiles p ON p.id = CAST(ga.uid AS TEXT)
WHERE ga.sub IS NOT NULL;
