import { json, requireUser, isResponse, type AppContext } from "../../../_lib/auth";

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  if (!context.env.STATUS_MEDIA) return json({ error:"Voice notes are unavailable." },503);

  const key = (context.params.key || "").trim();
  if (!/^voice-[0-9a-f-]{36}\.(webm|ogg|m4a|mp3|wav|aac)$/.test(key)) {
    return json({ error:"Voice note not found." },404);
  }

  const allowed = await context.env.DB.prepare(`
    SELECT 1 AS ok
    FROM direct_messages m
    INNER JOIN direct_conversation_members me
      ON me.conversation_id = m.conversation_id AND me.user_id = ? AND me.archived_at IS NULL
    INNER JOIN direct_conversation_members peer
      ON peer.conversation_id = m.conversation_id AND peer.user_id <> me.user_id
    WHERE m.deleted_at IS NULL
      AND instr(m.body, ?) > 0
      AND NOT EXISTS (
        SELECT 1 FROM direct_message_blocks b
        WHERE (b.blocker_id = me.user_id AND b.blocked_id = peer.user_id)
           OR (b.blocker_id = peer.user_id AND b.blocked_id = me.user_id)
      )
    LIMIT 1
  `).bind(user.id,"CLERKME_VOICE_NOTE_V1|"+key+"|").first();
  if (!allowed) return json({ error:"Voice note not found." },404);

  const object = await context.env.STATUS_MEDIA.get(key);
  if (!object) return json({ error:"Voice note not found." },404);
  return new Response(object.body,{
    headers:{
      "Content-Type":object.httpMetadata?.contentType || "application/octet-stream",
      "Content-Length":String(object.size),
      "Cache-Control":"private, no-store",
      "X-Content-Type-Options":"nosniff",
      "Content-Disposition":"inline"
    }
  });
};
