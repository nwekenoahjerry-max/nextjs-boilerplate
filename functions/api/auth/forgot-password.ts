import { json, validSameOrigin, type AppContext } from "../../_lib/auth";
import {
  checkAuthRateLimit, createEmailActionToken, isValidEmail, normaliseEmail, sendAuthEmail
} from "../../_lib/email-auth";

export const onRequestPost = async ({ request, env }: AppContext) => {
  if (!validSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.RESEND_API_KEY) return json({ error: "Password recovery is temporarily unavailable." }, 503);
  let body: { email?: unknown };
  try { body = await request.json() as typeof body; } catch { return json({ error: "Invalid request body." }, 400); }
  const email = normaliseEmail(typeof body.email === "string" ? body.email : "");
  if (!isValidEmail(email)) return json({ error: "Enter a valid email address." }, 400);

  if (!(await checkAuthRateLimit(env.DB, request, "forgot-password-ip", 6, 3600)) ||
      !(await checkAuthRateLimit(env.DB, request, "forgot-password-email", 3, 3600, email))) {
    return json({ error: "Too many requests. Please wait before requesting another reset email." }, 429);
  }

  const profile = await env.DB.prepare(
    "SELECT id FROM student_profiles WHERE email = ? COLLATE NOCASE AND email_verified_at IS NOT NULL"
  ).bind(email).first<{ id: string }>();
  if (profile) {
    const token = await createEmailActionToken(env.DB, profile.id, "password_reset", 3600);
    try { await sendAuthEmail(env, request, email, "password_reset", token); }
    catch { return json({ error: "We could not send a reset email. Please try again later." }, 503); }
  }
  return json({ ok: true, message: "If a verified ClerkMe account exists for this address, a password-reset link has been sent." });
};
