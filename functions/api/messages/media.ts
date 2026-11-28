import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../../_lib/auth";

const audioExtensions = new Map<string,string>([
  ["audio/webm","webm"],["audio/ogg","ogg"],["audio/mp4","m4a"],
  ["audio/mpeg","mp3"],["audio/wav","wav"],["audio/aac","aac"]
]);

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error:"Invalid upload origin." },403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  if (!context.env.STATUS_MEDIA) return json({ error:"Voice notes are not available in this environment yet." },503);

  let form:FormData;
  try { form = await context.request.formData(); }
  catch { return json({ error:"Choose a voice note to upload." },400); }

  const conversationId = typeof form.get("conversationId") === "string" ? String(form.get("conversationId")).trim() : "";
  const file = form.get("file");
  const durationSeconds = Number(form.get("durationSeconds));
  if (!conversationId || conversationId.length > 80) return json({ error:"Open a conversation before sending a voice note." },400);
  if (!(file instanceof File)) return json({ error:"Record a voice note before sending." },400);
  const mimeType = file.type.split(";")[0].trim().toLowerCase();
  const extension = audioExtensions.get(mimeType);
  if (!extension) return json({ error:"Use a supported voice-note recording format." },415);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 60) {
    return json({ error:"Voice notes must be between 1 and 60 seconds." },400);
  }
  if (file.size < 1 || file.size > 5*1024*1024) return json({ error:"Voice notes must be 5 MB or smaller." },413);

  const member = await context.env.DB.prepare(`
    SELECT peer.user_id AS peerId
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
  `).bind(conversationId,user.id).first<{peerId:string}>();
  if (!member) return json({ error:"This conversation is unavailable." },404);

  const mediaKey = "voice-" + crypto.randomUUID() + "." + extension;
  try {
    await context.env.STATUS_MEDIA.put(mediaKey,file,{
      httpMetadata:{contentType:mimeType},
      customMetadata:{ownerId:user.id,conversationId}
    });
    return json({ mediaKey,mediaType:mimeType,durationSeconds,byteSize:file.size },201);
  } catch (error) {
    await context.env.STATUS_MEDIA.delete(mediaKey).catch(()=>undefined);
    console.error("[messages] Voice-note upload failed",error instanceof Error?error.message:"unknown error");
    return json({ error:"Your voice note could not be uploaded. Please try again." },500);
  }
};
