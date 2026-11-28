import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  await context.env.DB.prepare(
    "UPDATE student_profiles SET last_seen_at = unixepoch() WHERE id = ?"
  ).bind(user.id).run();
  return json({ online: true, lastSeenAt: Math.floor(Date.now() / 1000) });
};
