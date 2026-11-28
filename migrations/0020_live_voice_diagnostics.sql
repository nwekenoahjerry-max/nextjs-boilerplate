CREATE TABLE IF NOT EXISTS live_voice_diagnostics (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  route TEXT NOT NULL,
  ray_id TEXT,
  stage TEXT NOT NULL,
  status_code INTEGER,
  model TEXT,
  error_code TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_live_voice_diagnostics_created_at
  ON live_voice_diagnostics(created_at);
