import { cookieHeader, json, sha256, validSameOrigin, type AppContext } from "../../_lib/auth";

export const onRequestPost = async ({ request, env }: AppContext) => {
  if (!validSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.GOOGLE_CLIENT_ID) return json({ error: "Google sign-in is not configured on the server." }, 503);
  let body: { credential?: string };
  try { body = await request.json() as { credential?: string }; } catch { return json({ error: "Invalid JSON body." }, 400); }
  const credential = body.credential;
  if (!credential || credential.length > 10000) return json({ error: "A valid Google credential is required." }, 400);

  const verify = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
  if (!verify.ok) return json({ error: "Google could not verify this sign-in. Please try again." }, 401);
  const claims = await verify.json() as { aud?: string; iss?: string; sub?: string; email?: string; email_verified?: string | boolean; name?: string; picture?: string; exp?: string };
  if (claims.aud !== env.GOOGLE_CLIENT_ID || !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss || "") || !claims.sub || !claims.email || String(claims.email_verified) !== "true" || Number(claims.exp) <= Math.floor(Date.now() / 1000)) {
    return json({ error: "The Google sign-in credential is invalid or expired." }, 401);
  }

  const userId = "usr_" + await sha256(claims.sub);
  await env.DB.prepare(`
    INSERT INTO users (id, google_sub, email, name, picture, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'student', datetime('now'), datetime('now'))
    ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email, name=excluded.name, picture=excluded.picture, updated_at=datetime('now')
  `).bind(userId, claims.sub, claims.email.toLowerCase(), claims.name || "ClerkMe user", claims.picture || null).run();

  const user = await env.DB.prepare("SELECT id, email, name, picture, role FROM users WHERE google_sub = ?").bind(claims.sub).first();
  const sessionToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
  const sessionHash = await sha256(sessionToken);
  await env.DB.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, datetime('now', '+7 days'), datetime('now'))")
    .bind(crypto.randomUUID(), userId, sessionHash).run();
  return json({ user }, 200, { "Set-Cookie": cookieHeader(sessionToken, 60 * 60 * 24 * 7) });
};
