import { json, sha256, validSameOrigin, type AppContext } from "../../_lib/auth";

export const onRequestPost = async ({ request, env }: AppContext) => {
  if (!validSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  let body: { token?: unknown };
  try { body = await request.json() as typeof body; } catch { return json({ error: "Invalid request body." }, 400); }
  const token = typeof body.token === "string" ? body.token : "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return json({ error: "This verification link is invalid or has expired." }, 400);

  const result = await env.DB.prepare(
    "UPDATE email_action_tokens SET consumed_at = unixepoch() " +
    "WHERE token_hash = ? AND purpose = 'verify_email' AND consumed_at IS NULL AND expires_at > unixepoch() " +
    "RETURNING user_id"
  ).bind(await sha256(token)).first<{ user_id: string }>();
  if (!result) return json({ error: "This verification link is invalid, expired or has already been used. Request a new one." }, 400);

  await env.DB.prepare(
    "UPDATE student_profiles SET email_verified_at = COALESCE(email_verified_at, unixepoch()), updated_at = unixepoch() WHERE id = ?"
  ).bind(result.user_id).run();
  return json({ ok: true });
};
