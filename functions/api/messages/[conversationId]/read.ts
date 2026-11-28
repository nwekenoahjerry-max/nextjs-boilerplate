import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../../_lib/auth";
import { hasAcceptedConnection } from "../../../_lib/connections";

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const conversationId = context.params.conversationId || "";
  let body: { messageId?: unknown };
  try { body = await context.request.json() as { messageId?: unknown }; }
  catch { return json({ error: "Invalid read receipt." }, 400); }
  const messageId = Number(body.messageId);
  if (!conversationId || !Number.isSafeInteger(messageId) || messageId < 1) return json({ error: "Invalid read receipt." }, 400);
  const member = await context.env.DB.prepare(`
    SELECT peer.user_id AS peerId
    FROM direct_conversation_members me
    INNER JOIN direct_conversation_members peer
      ON peer.conversation_id = me.conversation_id AND peer.user_id <> me.user_id
    WHERE me.conversation_id = ? AND me.user_id = ? AND me.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM direct_message_blocks b
        WHERE (b.blocker_id = me.user_id AND b.blocked_id = peer.user_id)
           OR (b.blocker_id = peer.user_id AND b.blocked_id = me.user_id)
      )
    LIMIT 1
  `).bind(conversationId, user.id).first<{peerId:string}>();
  if (!member || !await hasAcceptedConnection(context.env.DB, user.id, member.peerId)) {
    return json({ error: "Conversation not found." }, 404);
  }
  const message = await context.env.DB.prepare(
    "SELECT id FROM direct_messages WHERE id = ? AND conversation_id = ? AND deleted_at IS NULL"
  ).bind(messageId, conversationId).first<{ id: number }>();
  if (!message) return json({ error: "Message not found." }, 404);
  const updated = await context.env.DB.prepare(`
    UPDATE direct_conversation_members
    SET last_read_message_id = MAX(COALESCE(last_read_message_id, 0), ?), last_read_at = unixepoch()
    WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL
  `).bind(messageId, conversationId, user.id).run();
  const changes = Number((updated as { meta?: { changes?: number } }).meta?.changes || 0);
  if (changes < 1) return json({ error: "Conversation not found." }, 404);
  // Clear the conversation's grouped notification when its newest message is read.
  await context.env.DB.prepare(
    "UPDATE student_notifications SET is_read = 1, read_at = unixepoch() " +
    "WHERE user_id = ? AND kind = 'direct_message' AND dedupe_key = ? AND is_read = 0"
  ).bind(user.id, "direct-message:" + conversationId).run();
  return json({ read: true, lastReadMessageId: messageId });
};
