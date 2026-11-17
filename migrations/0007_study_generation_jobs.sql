-- Durable Gemini background jobs for long-running study guide generation.
CREATE TABLE IF NOT EXISTS study_generation_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES learning_materials(id) ON DELETE CASCADE,
  interaction_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('queued', 'in_progress', 'completed', 'failed')),
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_study_generation_jobs_user_material
  ON study_generation_jobs(user_id, material_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_generation_jobs_status
  ON study_generation_jobs(status, updated_at);
