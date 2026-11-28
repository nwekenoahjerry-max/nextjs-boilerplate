import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";
import { hasAcceptedConnection } from "../../_lib/connections";
const reasons = new Set(["harassment", "spam", "inappropriate", "misinformation", "other"]);

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  let body: { messageId?: unknown; reason?: unknown; details?: unknown };
  try { body = await context.request.json() as typeof body; }
  catch { return json({ error: "Select a message and report reason." }, 400); }
  const messageId = Number(body.messageId);
  const reason = typeof body.reason === "string" ? body.reason : "";
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 500) : "";
  if (!Number.isSafeInteger(messageId) || messageId < 1 || !reasons.has(reason)) return json({ error: "Select a valid message and report reason." }, 400);
  const message = await context.env.DB.prepare(`
    SELECT m.id, m.conversation_id AS conversationId, m.sender_id AS senderId,
      peer.user_id AS peerId
    FROM direct_messages m
    INNER JOIN direct_conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ? AND cm.archived_at IS NULL
    INNER JOIN direct_conversation_members peer ON peer.conversation_id = m.conversation_id AND peer.user_id <> cm.user_id
    WHERE m.id = ? AND m.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM direct_message_blocks b
        WHERE (b.blocker_id = cm.user_id AND b.blocked_id = peer.user_id)
           OR (b.blocker_id = peer.user_id AND b.blocked_id = cm.user_id)
      )
    LIMIT 1
  `).bind(user.id, messageId).first<{ id: number; conversationId: string; senderId: string; peerId: string }>();
  if (!message || message.senderId === user.id ||
      !await hasAcceptedConnection(context.env.DB, user.id, message.peerId)) {
    return json({ error: "That message cannot be reported." }, 404);
  }
  await context.env.DB.prepare(`
    INSERT INTO direct_message_reports
      (id, message_id, conversation_id, reporter_id, reported_user_id, reason, details, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open', unixepoch())
  `).bind(crypto.randomUUID(), message.id, message.conversationId, user.id, message.senderId, reason, details).run();
  return json({ reported: true }, 201);
};
