import { json, requireUser, isResponse, type AppContext } from "../../../_lib/auth";
import { canViewStatus } from "../../../_lib/status";

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  if (!context.env.STATUS_MEDIA) return json({ error:"Status media is unavailable." },503);
  const key = (context.params.key || "").trim();
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|webm)$/.test(key)) return json({ error:"Media not found." },404);
  const status = await context.env.DB.prepare(
    "SELECT id,media_type AS mediaType FROM status_posts WHERE media_key = ? AND expires_at > unixepoch() LIMIT 1"
  ).bind(key).first<{id:string;mediaType:string}>();
  if (!status || !await canViewStatus(context.env.DB,user.id,status.id)) return json({ error:"Media not found." },404);
  const object = await context.env.STATUS_MEDIA.get(key);
  if (!object) return json({ error:"Media not found." },404);
  return new Response(object.body,{
    headers:{
      "Content-Type":object.httpMetadata?.contentType || status.mediaType || "application/octet-stream",
      "Content-Length":String(object.size),
      "Cache-Control":"private, no-store",
      "X-Content-Type-Options":"nosniff",
      "Content-Disposition":"inline"
    }
  });
};