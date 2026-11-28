import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

export const onRequestDelete = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error:"Invalid request origin." },403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const id = (context.params.statusId || "").trim();
  if (!id || id.length > 80) return json({ error:"Status not found." },404);
  const status = await context.env.DB.prepare(
    "SELECT media_key AS mediaKey FROM status_posts WHERE id = ? AND user_id = ? LIMIT 1"
  ).bind(id,user.id).first<{mediaKey:string|null}>();
  if (!status) return json({ error:"Status not found." },404);
  await context.env.DB.prepare("DELETE FROM status_posts WHERE id = ? AND user_id = ?").bind(id,user.id).run();
  if (status.mediaKey && context.env.STATUS_MEDIA) {
    await context.env.STATUS_MEDIA.delete(status.mediaKey).catch(()=>undefined);
  }
  return json({ deleted:true });
};