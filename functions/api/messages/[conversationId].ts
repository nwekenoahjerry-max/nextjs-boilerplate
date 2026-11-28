import { json, requireUser, isResponse, type AppContext } from "../../_lib/auth";

type MessageRow = {
  id: number; public_id: string; conversation_id: string; sender_id: string;
  body: string; created_at: number; delivered_at: number | null;
};

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const conversationId = context.params.conversationId || "";
  if (!conversationId || conversationId.length > 80) return json({ error: "Conversation not found." }, 404);
  const membership = await context.env.DB.prepare(
    "SELECT last_read_message_id AS lastReadMessageId FROM direct_conversation_members WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL"
  ).bind(conversationId, user.id).first<{ lastReadMessageId: number | null }>();
  if (!membership) return json({ error: "Conversation not found." }, 404);
  const peerRead = await context.env.DB.prepare(
    "SELECT last_read_message_id AS lastReadMessageId FROM direct_conversation_members WHERE conversation_id = ? AND user_id <> ?"
  ).bind(conversationId, user.id).first<{ lastReadMessageId: number | null }>();
  const url = new URL(context.request.url);
  const rawBefore = url.searchParams.get("before");
  const before = rawBefore ? Number(rawBefore) : null;
  const rawLimit = Number(url.searchParams.get("limit") || 50);
  const limit = Number.isInteger(rawLimit) ? Math.max(1, Math.min(50, rawLimit)) : 50;
  if (before !== null && (!Number.isSafeInteger(before) || before < 1)) return json({ error: "Invalid message cursor." }, 400);
  const sql = before === null
    ? "SELECT id, public_id, conversation_id, sender_id, body, created_at, delivered_at FROM direct_messages WHERE conversation_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT ?"
    : "SELECT id, public_id, conversation_id, sender_id, body, created_at, delivered_at FROM direct_messages WHERE conversation_id = ? AND id < ? AND deleted_at IS NULL ORDER BY id DESC LIMIT ?";
  const result = before === null
    ? await context.env.DB.prepare(sql).bind(conversationId, limit + 1).all<MessageRow>()
    : await context.env.DB.prepare(sql).bind(conversationId, before, limit + 1).all<MessageRow>();
  const hasMore = result.results.length > limit;
  const messages = result.results.slice(0, limit).reverse();
  return json({
    messages, hasMore, nextCursor: hasMore && messages.length ? messages[0].id : null,
    lastReadMessageId: membership.lastReadMessageId,
    otherLastReadMessageId: peerRead?.lastReadMessageId ?? 0
  });
};
