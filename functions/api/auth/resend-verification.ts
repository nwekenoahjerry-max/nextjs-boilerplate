import { json, validSameOrigin, type AppContext } from "../../_lib/auth";
import {
  checkAuthRateLimit, createEmailActionToken, isValidEmail, normaliseEmail, sendAuthEmail
} from "../../_lib/email-auth";

export const onRequestPost = async ({ request, env }: AppContext) => {
  if (!validSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.RESEND_API_KEY) return json({ error: "Email delivery is temporarily unavailable." }, 503);
  let body: { email?: unknown };
  try { body = await request.json() as typeof body; } catch { return json({ error: "Invalid request body." }, 400); }
  const email = normaliseEmail(typeof body.email === "string" ? body.email : "");
  if (!isValidEmail(email)) return json({ error: "Enter a valid email address." }, 400);

  if (!(await checkAuthRateLimit(env.DB, request, "resend-verification-ip", 6, 3600)) ||
      !(await checkAuthRateLimit(env.DB, request, "resend-verification-email", 3, 3600, email))) {
    return json({ error: "Too many requests. Please wait before requesting another email." }, 429);
  }

  const profile = await env.DB.prepare(
    "SELECT id, email_verified_at FROM student_profiles WHERE email = ? COLLATE NOCASE"
  ).bind(email).first<{ id: string; email_verified_at: number | null }>();
  if (profile && !profile.email_verified_at) {
    const token = await createEmailActionToken(env.DB, profile.id, "verify_email", 86400);
    try { await sendAuthEmail(env, request, email, "verify_email", token); }
    catch { return json({ error: "We could not send the verification email. Please try again later." }, 503); }
  }
  return json({ ok: true, message: "If this address has an unverified ClerkMe account, a new verification link has been sent." });
};
