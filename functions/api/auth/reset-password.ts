import { json, sha256, validSameOrigin, type AppContext } from "../../_lib/auth";
import { hashPassword, randomHex } from "../../_lib/email-auth";

export const onRequestPost = async ({ request, env }: AppContext) => {
  if (!validSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  let body: { token?: unknown; password?: unknown };
  try { body = await request.json() as typeof body; } catch { return json({ error: "Invalid request body." }, 400); }
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return json({ error: "This password-reset link is invalid or has expired." }, 400);
  if (password.length < 12 || password.length > 128) {
    return json({ error: "Your new password must contain at least 12 characters and no more than 128." }, 400);
  }

  const tokenHash = await sha256(token);
  const pending = await env.DB.prepare(
    "SELECT user_id FROM email_action_tokens WHERE token_hash = ? AND purpose = 'password_reset' " +
    "AND consumed_at IS NULL AND expires_at > unixepoch()"
  ).bind(tokenHash).first<{ user_id: string }>();
  if (!pending) return json({ error: "This password-reset link is invalid, expired or has already been used. Request a new one." }, 400);

  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);
  const claimed = await env.DB.prepare(
    "UPDATE email_action_tokens SET consumed_at = unixepoch() " +
    "WHERE token_hash = ? AND purpose = 'password_reset' AND consumed_at IS NULL AND expires_at > unixepoch() " +
    "RETURNING user_id"
  ).bind(tokenHash).first<{ user_id: string }>();
  if (!claimed) return json({ error: "This password-reset link has already been used. Request a new one." }, 400);

  await env.DB.prepare(
    "UPDATE student_profiles SET password_salt = ?, password_hash = ?, updated_at = unixepoch() WHERE id = ?"
  ).bind(salt, passwordHash, claimed.user_id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(claimed.user_id).run();
  return json({ ok: true });
};
