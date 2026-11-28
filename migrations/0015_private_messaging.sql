-- ClerkMe private one-to-one messaging.
CREATE TABLE IF NOT EXISTS direct_conversations (
  id TEXT PRIMARY KEY,
  pair_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_message_id INTEGER,
  last_message_preview TEXT NOT NULL DEFAULT '',
  last_message_at INTEGER
);
CREATE TABLE IF NOT EXISTS direct_conversation_members (
  conversation_id TEXT NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_read_message_id INTEGER,
  last_read_at INTEGER,
  archived_at INTEGER,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS direct_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  conversation_id TEXT NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  client_message_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  delivered_at INTEGER,
  edited_at INTEGER,
  deleted_at INTEGER,
  UNIQUE (sender_id, client_message_id)
);
CREATE TABLE IF NOT EXISTS direct_message_blocks (
  blocker_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE TABLE IF NOT EXISTS direct_message_reports (
  id TEXT PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  reported_user_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'closed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_direct_members_user ON direct_conversation_members(user_id, archived_at, conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation ON direct_messages(conversation_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON direct_messages(sender_id, client_message_id);
CREATE INDEX IF NOT EXISTS idx_direct_blocks_target ON direct_message_blocks(blocked_id, blocker_id);
CREATE INDEX IF NOT EXISTS idx_direct_reports_status ON direct_message_reports(status, created_at DESC);
