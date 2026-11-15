-- Extend case records to every supported clinical unit.
-- Keep all existing case rows and user ownership intact.
CREATE TABLE cases_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  case_reference TEXT NOT NULL,
  title TEXT NOT NULL,
  specialty TEXT NOT NULL CHECK (specialty IN (
    'general-medicine','surgery','paediatrics','obstetrics-gynaecology',
    'emergency','psychiatry','community-medicine','orthopaedics','other'
  )),
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

INSERT INTO cases_new (
  id,user_id,case_reference,title,specialty,presenting_complaint,
  history_json,examination_json,assessment_json,plan_json,status,
  created_at,updated_at,deleted_at
)
SELECT
  id,user_id,case_reference,title,specialty,presenting_complaint,
  history_json,examination_json,assessment_json,plan_json,status,
  created_at,updated_at,deleted_at
FROM cases;

DROP TABLE cases;
ALTER TABLE cases_new RENAME TO cases;
CREATE INDEX IF NOT EXISTS idx_cases_user_updated ON cases(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_user_reference ON cases(user_id, case_reference);
