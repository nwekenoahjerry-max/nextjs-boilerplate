-- Private, account-scoped YouTube lecture library.
CREATE TABLE IF NOT EXISTS saved_learning_videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  youtube_video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  channel_title TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  duration TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  folder TEXT NOT NULL DEFAULT 'Unsorted',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, youtube_video_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_learning_videos_user_folder
  ON saved_learning_videos(user_id, folder COLLATE NOCASE, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_learning_videos_user_updated
  ON saved_learning_videos(user_id, updated_at DESC);
