import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";
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
    SELECT m.id, m.conversation_id AS conversationId, m.sender_id AS senderId
    FROM direct_messages m
    INNER JOIN direct_conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
    INNER JOIN direct_conversation_members peer ON peer.conversation_id=m.conversation_id AND peer.user_id<>cm.user_id
    INNER JOIN student_connections sc
      ON sc.user_a_id=CASE WHEN cm.user_id < peer.user_id THEN cm.user_id ELSE peer.user_id END
      AND sc.user_b_id=CASE WHEN cm.user_id < peer.user_id THEN peer.user_id ELSE cm.user_id END
    WHERE m.id = ? AND m.deleted_at IS NULL
  `).bind(user.id, messageId).first<{ id: number; conversationId: string; senderId: string }>();
  if (!message || message.senderId === user.id) return json({ error: "That message cannot be reported." }, 404);
  await context.env.DB.prepare(`
    INSERT INTO direct_message_reports
      (id, message_id, conversation_id, reporter_id, reported_user_id, reason, details, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open', unixepoch())
  `).bind(crypto.randomUUID(), message.id, message.conversationId, user.id, message.senderId, reason, details).run();
  return json({ reported: true }, 201);
};
