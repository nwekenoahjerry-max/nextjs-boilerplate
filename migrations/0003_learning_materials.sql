-- Private, account-scoped study materials for ClerkMe.
-- The text is extracted in the browser; original binary files are not uploaded.
CREATE TABLE IF NOT EXISTS learning_materials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Lecture notes',
  mime_type TEXT,
  content_text TEXT NOT NULL,
  summary_json TEXT,
  questions_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_learning_materials_user_unit
  ON learning_materials(user_id, unit, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_materials_user_created
  ON learning_materials(user_id, created_at DESC);
