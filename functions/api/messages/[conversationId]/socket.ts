import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../../_lib/auth";
import { hasAcceptedConnection } from "../../../_lib/connections";

export const onRequestGet = async (context: AppContext) => {
  if (context.request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "A WebSocket connection is required." }, 426);
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const conversationId = context.params.conversationId || "";
  if (!conversationId || conversationId.length > 80) return json({ error: "Conversation not found." }, 404);
  const member = await context.env.DB.prepare(
    "SELECT other.user_id AS otherId FROM direct_conversation_members me " +
    "INNER JOIN direct_conversation_members other ON other.conversation_id = me.conversation_id AND other.user_id <> me.user_id " +
    "WHERE me.conversation_id = ? AND me.user_id = ? AND me.archived_at IS NULL LIMIT 1"
  ).bind(conversationId, user.id).first<{otherId:string}>();
  if (!member || !await hasAcceptedConnection(context.env.DB, user.id, member.otherId)) {
    return json({ error: "You must be connected to this student before opening a private chat." }, 403);
  }
  const rooms = context.env.CHAT_ROOMS;
  if (!rooms) return json({ error: "Live messaging is not configured on this environment yet." }, 503);
  // Forward the original upgrade request so the Cloudflare WebSocket handshake is preserved.
  return rooms.get(rooms.idFromName(conversationId)).fetch(context.request);
};
