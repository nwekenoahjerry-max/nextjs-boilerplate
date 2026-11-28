-- Private 24-hour status updates, viewer receipts, preferences and reply links.
CREATE TABLE IF NOT EXISTS status_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 500),
  background TEXT NOT NULL DEFAULT '#173765',
  visibility TEXT NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone','conversations','only_me')),
  media_key TEXT UNIQUE,
  media_type TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  CHECK (length(body) > 0 OR media_key IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_status_posts_expiry ON status_posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_status_posts_user_expiry ON status_posts(user_id,expires_at DESC);
CREATE TABLE IF NOT EXISTS status_views (
  status_id TEXT NOT NULL REFERENCES status_posts(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  viewed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (status_id,viewer_id)
);
CREATE INDEX IF NOT EXISTS idx_status_views_viewed ON status_views(status_id,viewed_at DESC);
CREATE TABLE IF NOT EXISTS status_media_uploads (
  media_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_status_media_uploads_user ON status_media_uploads(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS status_preferences (
  user_id TEXT PRIMARY KEY REFERENCES student_profiles(id) ON DELETE CASCADE,
  default_audience TEXT NOT NULL DEFAULT 'everyone' CHECK (default_audience IN ('everyone','conversations','only_me')),
  hide_views INTEGER NOT NULL DEFAULT 0 CHECK (hide_views IN (0,1)),
  allow_replies INTEGER NOT NULL DEFAULT 1 CHECK (allow_replies IN (0,1)),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS status_replies (
  id TEXT PRIMARY KEY,
  status_id TEXT NOT NULL REFERENCES status_posts(id) ON DELETE CASCADE,
  message_id INTEGER NOT NULL UNIQUE REFERENCES direct_messages(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_status_replies_status ON status_replies(status_id,created_at DESC);