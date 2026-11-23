import { json, validSameOrigin, type AppContext } from "../../_lib/auth";
import {
  checkAuthRateLimit, createEmailActionToken, hashPassword, isValidEmail,
  normaliseEmail, randomHex, sendAuthEmail
} from "../../_lib/email-auth";

export const onRequestPost = async ({ request, env }: AppContext) => {
  if (!validSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.RESEND_API_KEY) return json({ error: "Email verification is not configured yet. Please try again later." }, 503);

  let body: { name?: unknown; email?: unknown; password?: unknown };
  try { body = await request.json() as typeof body; } catch { return json({ error: "Invalid request body." }, 400); }
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const email = normaliseEmail(typeof body.email === "string" ? body.email : "");
  const password = typeof body.password === "string" ? body.password : "";

  if (name.length < 2 || name.length > 100) return json({ error: "Enter your full name (2–100 characters)." }, 400);
  if (!isValidEmail(email)) return json({ error: "Enter a valid email address." }, 400);
  if (password.length < 12 || password.length > 128) {
    return json({ error: "Your password must contain at least 12 characters and no more than 128." }, 400);
  }

  if (!(await checkAuthRateLimit(env.DB, request, "register-ip", 5, 3600)) ||
      !(await checkAuthRateLimit(env.DB, request, "register-email", 3, 3600, email))) {
    return json({ error: "Too many registration attempts. Please try again later." }, 429);
  }

  const existing = await env.DB.prepare("SELECT id FROM student_profiles WHERE email = ? COLLATE NOCASE")
    .bind(email).first<{ id: string }>();
  if (existing) return json({
    error: "An account with this email already exists. Sign in or use the password-reset option."
  }, 409);

  const userId = crypto.randomUUID();
  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);
  try {
    await env.DB.prepare(
      "INSERT INTO student_profiles (id, email, password_salt, password_hash, full_name, school, level, country, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, '', '', '', unixepoch(), unixepoch())"
    ).bind(userId, email, salt, passwordHash, name).run();
  } catch (error) {
    console.error("[clerkme-auth] Account creation failed.", error instanceof Error ? error.message : "database error");
    return json({ error: "We could not create the account. Please try again." }, 500);
  }

  const token = await createEmailActionToken(env.DB, userId, "verify_email", 86400);
  try {
    await sendAuthEmail(env, request, email, "verify_email", token);
  } catch {
    return json({
      ok: false,
      verificationPending: true,
      error: "Your account has been created, but the verification email could not be sent. Use the resend option below."
    }, 503);
  }

  return json({ ok: true, verificationRequired: true });
};
