import {
  cookieHeader, hasAdminAccess, json, sha256, validSameOrigin, type AppContext
} from "../../_lib/auth";
import {
  checkAuthRateLimit, isValidEmail, normaliseEmail, verifyPassword
} from "../../_lib/email-auth";

export const onRequestPost = async ({ request, env }: AppContext) => {
  if (!validSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);

  let body: { email?: unknown; password?: unknown };
  try { body = await request.json() as typeof body; } catch { return json({ error: "Invalid request body." }, 400); }
  const email = normaliseEmail(typeof body.email === "string" ? body.email : "");
  const password = typeof body.password === "string" ? body.password : "";
  if (!isValidEmail(email) || !password || password.length > 128) {
    return json({ error: "Enter your email address and password." }, 400);
  }

  if (!(await checkAuthRateLimit(env.DB, request, "login-ip", 12, 900)) ||
      !(await checkAuthRateLimit(env.DB, request, "login-email", 8, 900, email))) {
    return json({ error: "Too many sign-in attempts. Please wait 15 minutes and try again." }, 429);
  }

  const profile = await env.DB.prepare(
    "SELECT id, email, password_salt, password_hash, email_verified_at FROM student_profiles WHERE email = ? COLLATE NOCASE"
  ).bind(email).first<{
    id: string; email: string; password_salt: string; password_hash: string; email_verified_at: number | null;
  }>();

  if (!profile || !(await verifyPassword(password, profile.password_salt, profile.password_hash))) {
    return json({ error: "The email address or password is incorrect." }, 401);
  }
  if (!profile.email_verified_at) {
    return json({
      error: "Please verify your email address before signing in.",
      code: "EMAIL_NOT_VERIFIED",
      verificationRequired: true
    }, 403);
  }

  const sessionToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
  const sessionHash = await sha256(sessionToken);
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, unixepoch() + 604800, unixepoch())"
  ).bind(sessionHash, profile.id).run();

  const role = hasAdminAccess(profile.email, env) ? "admin" : "student";
  const user = await env.DB.prepare(
    "SELECT id, email, full_name AS name, NULL AS picture, ? AS role FROM student_profiles WHERE id = ?"
  ).bind(role, profile.id).first();
  return json({ user }, 200, { "Set-Cookie": cookieHeader(sessionToken, 60 * 60 * 24 * 7) });
};
