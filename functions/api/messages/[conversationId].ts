import { json, requireUser, isResponse, type AppContext } from "../../_lib/auth";
import { areConnected } from "../../_lib/connections";

type MessageRow = {
  id: number; public_id: string; conversation_id: string; sender_id: string;
  body: string; created_at: number; delivered_at: number | null; reply_to_status_id: string | null;
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
  const peer = await context.env.DB.prepare(
    "SELECT user_id AS id FROM direct_conversation_members WHERE conversation_id = ? AND user_id <> ? LIMIT 1"
  ).bind(conversationId,user.id).first<{id:string}>();
  if (!peer || !await areConnected(context.env.DB,user.id,peer.id)) return json({ error: "Conversation not found." }, 404);
  const blocked = await context.env.DB.prepare(`
    SELECT 1 AS blocked
    FROM direct_conversation_members peer
    INNER JOIN direct_message_blocks b
      ON (b.blocker_id = ? AND b.blocked_id = peer.user_id)
      OR (b.blocker_id = peer.user_id AND b.blocked_id = ?)
    WHERE peer.conversation_id = ? AND peer.user_id <> ?
    LIMIT 1
  `).bind(user.id, user.id, conversationId, user.id).first();
  if (blocked) return json({ error: "Conversation not found." }, 404);
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
    ? "SELECT m.id, m.public_id, m.conversation_id, m.sender_id, m.body, m.created_at, m.delivered_at, m.edited_at, sr.status_id AS reply_to_status_id FROM direct_messages m LEFT JOIN status_replies sr ON sr.message_id = m.id WHERE m.conversation_id = ? AND m.deleted_at IS NULL ORDER BY m.id DESC LIMIT ?"
    : "SELECT m.id, m.public_id, m.conversation_id, m.sender_id, m.body, m.created_at, m.delivered_at, m.edited_at, sr.status_id AS reply_to_status_id FROM direct_messages m LEFT JOIN status_replies sr ON sr.message_id = m.id WHERE m.conversation_id = ? AND m.id < ? AND m.deleted_at IS NULL ORDER BY m.id DESC LIMIT ?";
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
