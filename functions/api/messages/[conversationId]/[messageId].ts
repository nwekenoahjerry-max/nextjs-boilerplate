import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../../_lib/auth";
import { areConnected } from "../../../_lib/connections";

type EditableMessage = {
  id: number; public_id: string; conversation_id: string; sender_id: string;
  client_message_id: string; body: string; created_at: number;
  delivered_at: number | null; edited_at: number | null; reply_to_status_id: string | null;
};

export const onRequestPatch = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;

  const conversationId = context.params.conversationId || "";
  const messageId = Number(context.params.messageId);
  if (!conversationId || conversationId.length > 80 || !Number.isSafeInteger(messageId) || messageId < 1) {
    return json({ error: "Message not found." }, 404);
  }

  let input: { body?: unknown };
  try { input = await context.request.json() as { body?: unknown }; }
  catch { return json({ error: "Enter a valid message." }, 400); }
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!body || body.length > 4000) {
    return json({ error: "Messages must contain between 1 and 4,000 characters." }, 400);
  }

  const membership = await context.env.DB.prepare(`
    SELECT 1 AS ok
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
  `).bind(conversationId, user.id).first();
  if (!membership) return json({ error: "Conversation not found." }, 404);
  const peer = await context.env.DB.prepare(
    "SELECT user_id AS id FROM direct_conversation_members WHERE conversation_id=? AND user_id<>? LIMIT 1"
  ).bind(conversationId,user.id).first<{id:string}>();
  if (!peer || !await areConnected(context.env.DB,user.id,peer.id)) return json({error:"Conversation not found."},404);

  const existing = await context.env.DB.prepare(
    "SELECT id, sender_id FROM direct_messages WHERE id = ? AND conversation_id = ? AND deleted_at IS NULL"
  ).bind(messageId, conversationId).first<{ id: number; sender_id: string }>();
  if (!existing) return json({ error: "Message not found." }, 404);
  if (existing.sender_id !== user.id) return json({ error: "You can only edit messages you sent." }, 403);

  await context.env.DB.prepare(
    "UPDATE direct_messages SET body = ?, edited_at = unixepoch() WHERE id = ? AND conversation_id = ? AND sender_id = ? AND deleted_at IS NULL"
  ).bind(body, messageId, conversationId, user.id).run();

  const preview = body.length > 160 ? body.slice(0, 157) + "…" : body;
  await context.env.DB.prepare(
    "UPDATE direct_conversations SET last_message_preview = ?, updated_at = unixepoch() WHERE id = ? AND last_message_id = ?"
  ).bind(preview, conversationId, messageId).run();

  const message = await context.env.DB.prepare(
    "SELECT m.id, m.public_id, m.conversation_id, m.sender_id, m.client_message_id, m.body, m.created_at, m.delivered_at, m.edited_at, sr.status_id AS reply_to_status_id " +
    "FROM direct_messages m LEFT JOIN status_replies sr ON sr.message_id = m.id " +
    "WHERE m.id = ? AND m.conversation_id = ? AND m.deleted_at IS NULL LIMIT 1"
  ).bind(messageId, conversationId).first<EditableMessage>();
  if (!message) return json({ error: "Your message could not be saved. Please try again." }, 500);

  // Notify open conversation sockets. The database remains authoritative if a
  // recipient is temporarily offline; their next history request sees this edit.
  if (context.env.CHAT_ROOMS) {
    try {
      const room = context.env.CHAT_ROOMS.get(context.env.CHAT_ROOMS.idFromName(conversationId));
      await room.fetch(new Request("https://clerkme-chat.internal/internal/message-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, messageId })
      }));
    } catch (error) {
      console.error("[clerkme-messages] Edited-message broadcast failed.", error instanceof Error ? error.message : "unknown error");
    }
  }

  return json({ message });
};
