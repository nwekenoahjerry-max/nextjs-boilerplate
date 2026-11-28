import { json, requireUser, isResponse, type AppContext } from "../../../_lib/auth";

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const id = (context.params.statusId || "").trim();
  const status = await context.env.DB.prepare(
    "SELECT id FROM status_posts WHERE id = ? AND user_id = ? AND expires_at > unixepoch() LIMIT 1"
  ).bind(id,user.id).first();
  if (!status) return json({ error:"Status not found." },404);
  const result = await context.env.DB.prepare(
    "SELECT p.id,p.full_name AS name,p.school AS university,v.viewed_at AS viewedAt " +
    "FROM status_views v INNER JOIN student_profiles p ON p.id = v.viewer_id " +
    "LEFT JOIN status_preferences prefs ON prefs.user_id = v.viewer_id " +
    "WHERE v.status_id = ? AND COALESCE(prefs.hide_views,0) = 0 ORDER BY v.viewed_at DESC LIMIT 100"
  ).bind(id).all<{id:string;name:string;university:string;viewedAt:number}>();
  return json({ viewers:result.results });
};