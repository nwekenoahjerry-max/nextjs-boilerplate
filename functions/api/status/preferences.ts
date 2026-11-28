import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";
import { getStatusPreferences } from "../../_lib/status";

const serialize = (prefs: Awaited<ReturnType<typeof getStatusPreferences>>) => ({
  defaultAudience:prefs.default_audience,
  hideViews:prefs.hide_views === 1,
  allowReplies:prefs.allow_replies === 1
});

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  return json(serialize(await getStatusPreferences(context.env.DB,user.id)));
};

export const onRequestPatch = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error:"Invalid request origin." },403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  let input:Record<string,unknown>;
  try {
    const value:unknown = await context.request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error:"Invalid privacy settings." },400);
    input = value as Record<string,unknown>;
  } catch { return json({ error:"Invalid privacy settings." },400); }
  const previous = await getStatusPreferences(context.env.DB,user.id);
  const audience = input.defaultAudience === undefined ? previous.default_audience : input.defaultAudience;
  if (!["everyone","conversations","only_me"].includes(String(audience))) return json({ error:"Choose a valid status audience." },400);
  const hideViews = input.hideViews === undefined ? previous.hide_views : input.hideViews === true ? 1 : 0;
  const allowReplies = input.allowReplies === undefined ? previous.allow_replies : input.allowReplies === true ? 1 : 0;
  await context.env.DB.prepare(
    "INSERT INTO status_preferences (user_id,default_audience,hide_views,allow_replies,updated_at) VALUES (?,?,?,?,unixepoch()) " +
    "ON CONFLICT(user_id) DO UPDATE SET default_audience=excluded.default_audience,hide_views=excluded.hide_views," +
    "allow_replies=excluded.allow_replies,updated_at=unixepoch()"
  ).bind(user.id,audience,hideViews,allowReplies).run();
  return json({ defaultAudience:audience,hideViews:hideViews===1,allowReplies:allowReplies===1 });
};