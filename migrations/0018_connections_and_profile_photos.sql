-- Accepted ClerkMe student connections and a single private profile photo.
-- Existing direct conversations are grandfathered as accepted connections so
-- current users keep access after connection approval is introduced.
CREATE TABLE IF NOT EXISTS student_connections (
  user_a_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  user_b_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)
);
CREATE INDEX IF NOT EXISTS idx_student_connections_b ON student_connections(user_b_id,user_a_id);

CREATE TABLE IF NOT EXISTS student_connection_requests (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (sender_id,recipient_id),
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_connection_requests_recipient ON student_connection_requests(recipient_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connection_requests_sender ON student_connection_requests(sender_id,status,created_at DESC);

INSERT OR IGNORE INTO student_connections (user_a_id,user_b_id,created_at)
SELECT a.user_id,b.user_id,MIN(a.joined_at,b.joined_at)
FROM direct_conversation_members a
INNER JOIN direct_conversation_members b ON b.conversation_id=a.conversation_id AND a.user_id < b.user_id
GROUP BY a.user_id,b.user_id;

ALTER TABLE student_profiles ADD COLUMN profile_photo_key TEXT;
ALTER TABLE student_profiles ADD COLUMN profile_photo_type TEXT;
