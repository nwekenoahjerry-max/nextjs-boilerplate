import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../../_lib/auth";
import { canViewStatus } from "../../../_lib/status";

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error:"Invalid request origin." },403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const statusId = (context.params.statusId || "").trim();
  if (!statusId || statusId.length > 80 || !await canViewStatus(context.env.DB,user.id,statusId)) {
    return json({ error:"This status is no longer available." },404);
  }
  await context.env.DB.prepare(
    "INSERT OR IGNORE INTO status_views (status_id,viewer_id,viewed_at) " +
    "SELECT id,?,unixepoch() FROM status_posts WHERE id = ? AND user_id <> ? AND expires_at > unixepoch()"
  ).bind(user.id,statusId,user.id).run();
  return json({ viewed:true });
};