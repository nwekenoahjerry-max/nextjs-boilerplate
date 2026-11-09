import { cookieHeader, json, sha256, validSameOrigin, type AppContext } from "../../_lib/auth";
const randomHex = (bytes: number) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2, "0")).join("");

export const onRequestPost = async ({ request, env }: AppContext) => {
  if (!validSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.GOOGLE_CLIENT_ID) return json({ error: "Google sign-in is not configured on the server." }, 503);
  let body: { credential?: string };
  try { body = await request.json() as { credential?: string }; } catch { return json({ error: "Invalid JSON body." }, 400); }
  const credential = body.credential;
  if (!credential || credential.length > 10000) return json({ error: "A valid Google credential is required." }, 400);

  const verify = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
  if (!verify.ok) return json({ error: "Google could not verify this sign-in. Please try again." }, 401);
  const claims = await verify.json() as { aud?: string; iss?: string; sub?: string; email?: string; email_verified?: string | boolean; name?: string; exp?: string };
  if (claims.aud !== env.GOOGLE_CLIENT_ID || !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss || "") || !claims.sub || !claims.email || String(claims.email_verified) !== "true" || Number(claims.exp) <= Math.floor(Date.now() / 1000)) {
    return json({ error: "The Google sign-in credential is invalid or expired." }, 401);
  }

  const email = claims.email.toLowerCase();
  const linked = await env.DB.prepare("SELECT user_id FROM google_identities WHERE google_sub = ?").bind(claims.sub).first<{ user_id: string }>();
  let userId = linked?.user_id;
  if (!userId) {
    const existing = await env.DB.prepare("SELECT id FROM student_profiles WHERE email = ? COLLATE NOCASE").bind(email).first<{ id: string }>();
    userId = existing?.id || crypto.randomUUID();
    if (!existing) {
      await env.DB.prepare("INSERT INTO student_profiles (id, email, password_salt, password_hash, full_name, school, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '', 'Clinical year 1', unixepoch(), unixepoch())")
        .bind(userId, email, randomHex(16), randomHex(32), claims.name || "ClerkMe user").run();
    }
    await env.DB.prepare("INSERT INTO google_identities (google_sub, user_id, created_at) VALUES (?, ?, unixepoch())").bind(claims.sub, userId).run();
  }

  const sessionToken = randomHex(32);
  const sessionHash = await sha256(sessionToken);
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, unixepoch() + 604800, unixepoch())")
    .bind(sessionHash, userId).run();
  const user = await env.DB.prepare("SELECT id, email, full_name AS name, NULL AS picture, 'student' AS role FROM student_profiles WHERE id = ?").bind(userId).first();
  return json({ user }, 200, { "Set-Cookie": cookieHeader(sessionToken, 60 * 60 * 24 * 7) });
};
