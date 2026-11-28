import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../../_lib/auth";

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
  return json({ read: true, lastReadMessageId: messageId });
};
