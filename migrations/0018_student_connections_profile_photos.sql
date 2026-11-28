-- Mutual connection approval is required before students can start or continue private chats.
CREATE TABLE IF NOT EXISTS student_connections (
  id TEXT PRIMARY KEY,
  user_low_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  user_high_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  requested_to TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'removed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  responded_at INTEGER,
  UNIQUE (user_low_id, user_high_id),
  CHECK (user_low_id < user_high_id),
  CHECK (requested_by <> requested_to),
  CHECK (
    (requested_by = user_low_id AND requested_to = user_high_id)
    OR (requested_by = user_high_id AND requested_to = user_low_id)
  )
);
CREATE INDEX IF NOT EXISTS idx_student_connections_incoming
  ON student_connections(requested_to, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_connections_outgoing
  ON student_connections(requested_by, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_connections_pair_status
  ON student_connections(user_low_id, user_high_id, status);

-- One reusable profile image per student. The actual object remains in private R2.
ALTER TABLE student_profiles ADD COLUMN profile_photo_key TEXT;
ALTER TABLE student_profiles ADD COLUMN profile_photo_updated_at INTEGER;

-- Existing active private conversations represent established relationships.
-- Preserve those relationships as accepted so current chats are not unexpectedly locked.
INSERT OR IGNORE INTO student_connections
  (id, user_low_id, user_high_id, requested_by, requested_to, status, created_at, updated_at, responded_at)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6))),
  a.user_id, b.user_id, a.user_id, b.user_id, 'accepted',
  MIN(c.created_at), unixepoch(), unixepoch()
FROM direct_conversation_members a
INNER JOIN direct_conversation_members b
  ON b.conversation_id = a.conversation_id AND a.user_id < b.user_id
INNER JOIN direct_conversations c ON c.id = a.conversation_id
WHERE a.archived_at IS NULL AND b.archived_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM direct_message_blocks blocked
    WHERE (blocked.blocker_id = a.user_id AND blocked.blocked_id = b.user_id)
       OR (blocked.blocker_id = b.user_id AND blocked.blocked_id = a.user_id)
  )
GROUP BY a.user_id, b.user_id;
