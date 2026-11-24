import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

type PushBody = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
const validBase64Url = (value: string, max: number) => value.length > 0 && value.length <= max && /^[A-Za-z0-9_-]+$/.test(value);

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context); if (isResponse(user)) return user;
  let body: PushBody;
  try { body = await context.request.json() as PushBody; } catch { return json({ error: "Invalid push subscription." }, 400); }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  let endpointUrl: URL;
  try { endpointUrl = new URL(endpoint); } catch { return json({ error: "The browser returned an invalid push endpoint." }, 400); }
  if (endpointUrl.protocol !== "https:" || endpoint.length > 2048 || !validBase64Url(p256dh, 256) || !validBase64Url(auth, 128)) return json({ error: "The push subscription could not be validated. Please try enabling notifications again." }, 400);
  const userAgent = (context.request.headers.get("User-Agent") || "").slice(0, 500);
  await context.env.DB.prepare("INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, unixepoch()) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, created_at = unixepoch()")
    .bind(crypto.randomUUID(), user.id, endpoint, p256dh, auth, userAgent).run();
  return json({ subscribed: true });
};

export const onRequestDelete = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context); if (isResponse(user)) return user;
  let body: { endpoint?: unknown };
  try { body = await context.request.json() as { endpoint?: unknown }; } catch { return json({ error: "Invalid subscription request." }, 400); }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint || endpoint.length > 2048) return json({ error: "Select a push subscription to remove." }, 400);
  await context.env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?").bind(user.id, endpoint).run();
  return json({ subscribed: false });
};
