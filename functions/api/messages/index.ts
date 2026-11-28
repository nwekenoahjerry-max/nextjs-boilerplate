import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";
import { areConnected } from "../../_lib/connections";

type ConversationRow = {
  id: string; otherId: string; otherName: string; otherUniversity: string; otherLevel: string; otherPhotoUrl?:string|null;
  otherLastSeenAt: number | null; lastMessagePreview: string; lastMessageAt: number | null;
  lastMessageSenderId: string | null; lastReadMessageId: number | null; unreadCount: number;
};

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const result = await context.env.DB.prepare(`
    SELECT c.id, other.user_id AS otherId, p.full_name AS otherName,
      p.school AS otherUniversity, p.level AS otherLevel, p.last_seen_at AS otherLastSeenAt,
      CASE WHEN p.profile_photo_key IS NOT NULL THEN '/api/profile/photo?userId=' || p.id ELSE NULL END AS otherPhotoUrl,
      c.last_message_preview AS lastMessagePreview, c.last_message_at AS lastMessageAt,
      m.sender_id AS lastMessageSenderId, me.last_read_message_id AS lastReadMessageId,
      (SELECT COUNT(*) FROM direct_messages unread
        WHERE unread.conversation_id = c.id AND unread.sender_id <> ?
          AND unread.deleted_at IS NULL
          AND unread.id > COALESCE(me.last_read_message_id, 0)) AS unreadCount
    FROM direct_conversations c
    INNER JOIN direct_conversation_members me
      ON me.conversation_id = c.id AND me.user_id = ? AND me.archived_at IS NULL
    INNER JOIN direct_conversation_members other
      ON other.conversation_id = c.id AND other.user_id <> ?
    INNER JOIN student_profiles p ON p.id = other.user_id
    LEFT JOIN direct_messages m ON m.id = c.last_message_id
    WHERE EXISTS (
      SELECT 1 FROM student_connections sc
      WHERE sc.user_a_id = CASE WHEN me.user_id < other.user_id THEN me.user_id ELSE other.user_id END
        AND sc.user_b_id = CASE WHEN me.user_id < other.user_id THEN other.user_id ELSE me.user_id END
    )
      AND NOT EXISTS (
        SELECT 1 FROM direct_message_blocks b
        WHERE (b.blocker_id = me.user_id AND b.blocked_id = other.user_id)
           OR (b.blocker_id = other.user_id AND b.blocked_id = me.user_id)
      )
    ORDER BY COALESCE(c.last_message_at, c.created_at) DESC LIMIT 100
  `).bind(user.id, user.id, user.id).all<ConversationRow>();
  const unread = await context.env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM direct_conversation_members me
    INNER JOIN direct_conversation_members other
      ON other.conversation_id = me.conversation_id AND other.user_id <> me.user_id
    INNER JOIN direct_messages message
      ON message.conversation_id = me.conversation_id
      AND message.sender_id = other.user_id
      AND message.deleted_at IS NULL
      AND message.id > COALESCE(me.last_read_message_id, 0)
    WHERE me.user_id = ? AND me.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM direct_message_blocks b
        WHERE (b.blocker_id = me.user_id AND b.blocked_id = other.user_id)
           OR (b.blocker_id = other.user_id AND b.blocked_id = me.user_id)
      )
  `).bind(user.id).first<{ count: number }>();
  return json({
    conversations: result.results,
    totalUnreadCount: Number(unread?.count) || 0
  });
};

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  let body: { recipientId?: unknown };
  try { body = await context.request.json() as { recipientId?: unknown }; }
  catch { return json({ error: "Choose a student to start a conversation." }, 400); }
  const recipientId = typeof body.recipientId === "string" ? body.recipientId.trim() : "";
  if (!recipientId || recipientId.length > 100 || recipientId === user.id) return json({ error: "Choose a valid student." }, 400);
  const recipient = await context.env.DB.prepare(
    "SELECT id FROM student_profiles WHERE id = ? AND email_verified_at IS NOT NULL"
  ).bind(recipientId).first<{ id: string }>();
  if (!recipient) return json({ error: "That student account could not be found." }, 404);
  if (!await areConnected(context.env.DB,user.id,recipientId)) {
    return json({ error: "Send a connection request and wait for the student to accept before starting a private chat." }, 403);
  }
  const blocked = await context.env.DB.prepare(`
    SELECT 1 AS blocked FROM direct_message_blocks
    WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1
  `).bind(user.id, recipientId, recipientId, user.id).first();
  if (blocked) return json({ error: "This conversation is unavailable." }, 403);
  const pairKey = [user.id, recipientId].sort().join(":");
  await context.env.DB.prepare(
    "INSERT OR IGNORE INTO direct_conversations (id, pair_key, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())"
  ).bind(crypto.randomUUID(), pairKey).run();
  const conversation = await context.env.DB.prepare(
    "SELECT id FROM direct_conversations WHERE pair_key = ?"
  ).bind(pairKey).first<{ id: string }>();
  if (!conversation) return json({ error: "ClerkMe could not create this conversation. Please try again." }, 500);
  await context.env.DB.prepare(
    "INSERT OR IGNORE INTO direct_conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, unixepoch()), (?, ?, unixepoch())"
  ).bind(conversation.id, user.id, conversation.id, recipientId).run();
  const profile = await context.env.DB.prepare(
    "SELECT id, full_name AS name, school AS university, level, last_seen_at AS lastSeenAt, CASE WHEN profile_photo_key IS NOT NULL THEN '/api/profile/photo?userId=' || id ELSE NULL END AS photoUrl FROM student_profiles WHERE id = ?"
  ).bind(recipientId).first();
  return json({ conversation: { id: conversation.id, other: profile } }, 201);
};
