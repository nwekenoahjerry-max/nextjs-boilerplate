import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../../_lib/auth";
import { areConnected } from "../../../_lib/connections";

export const onRequestGet = async (context: AppContext) => {
  if (context.request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "A WebSocket connection is required." }, 426);
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const conversationId = context.params.conversationId || "";
  if (!conversationId || conversationId.length > 80) return json({ error: "Conversation not found." }, 404);
  const member = await context.env.DB.prepare(
    "SELECT 1 AS ok FROM direct_conversation_members WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL"
  ).bind(conversationId, user.id).first();
  const peer = await context.env.DB.prepare(
    "SELECT user_id AS id FROM direct_conversation_members WHERE conversation_id = ? AND user_id <> ? LIMIT 1"
  ).bind(conversationId,user.id).first<{id:string}>();
  if (!member || !peer || !await areConnected(context.env.DB,user.id,peer.id)) return json({ error: "Conversation not found." }, 404);
  const rooms = context.env.CHAT_ROOMS;
  if (!rooms) return json({ error: "Live messaging is not configured on this environment yet." }, 503);
  // Forward the original upgrade request so the Cloudflare WebSocket handshake is preserved.
  return rooms.get(rooms.idFromName(conversationId)).fetch(context.request);
};
