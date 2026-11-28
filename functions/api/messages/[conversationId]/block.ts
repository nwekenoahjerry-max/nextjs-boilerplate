import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../../_lib/auth";

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const conversationId = context.params.conversationId || "";
  const other = await context.env.DB.prepare(
    "SELECT user_id AS id FROM direct_conversation_members WHERE conversation_id = ? AND user_id <> ?"
  ).bind(conversationId, user.id).first<{ id: string }>();
  const membership = await context.env.DB.prepare(
    "SELECT 1 AS ok FROM direct_conversation_members WHERE conversation_id = ? AND user_id = ?"
  ).bind(conversationId, user.id).first();
  if (!membership || !other) return json({ error: "Conversation not found." }, 404);
  await context.env.DB.prepare(
    "INSERT OR IGNORE INTO direct_message_blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, unixepoch())"
  ).bind(user.id, other.id).run();
  return json({ blocked: true });
};
