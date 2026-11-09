-- Additive ClerkMe case-record schema.
-- Existing student_profiles, google_identities and sessions tables are retained.
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  case_reference TEXT NOT NULL,
  title TEXT NOT NULL,
  specialty TEXT NOT NULL CHECK (specialty IN ('general-medicine','paediatrics','obstetrics-gynaecology','surgery','emergency','other')),
  presenting_complaint TEXT NOT NULL,
  history_json TEXT NOT NULL DEFAULT '{}',
  examination_json TEXT NOT NULL DEFAULT '{}',
  assessment_json TEXT NOT NULL DEFAULT '{}',
  plan_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in-progress','completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cases_user_updated ON cases(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_user_reference ON cases(user_id, case_reference);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  case_id TEXT,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_events(user_id, created_at DESC);
