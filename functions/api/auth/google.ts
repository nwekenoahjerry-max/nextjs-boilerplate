import { cookieHeader, json, sha256, validSameOrigin, type AppContext } from "../../_lib/auth";
const randomHex = (bytes: number) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2, "0")).join("");
const decodePart = (part: string) => {
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
};
const decodeJson = (part: string) => JSON.parse(new TextDecoder().decode(decodePart(part)));

async function verifyGoogleIdToken(token: string, clientId: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = decodeJson(parts[0]) as { alg?: string; kid?: string };
    const claims = decodeJson(parts[1]) as { aud?: string; iss?: string; sub?: string; email?: string; email_verified?: boolean; name?: string; exp?: number; iat?: number };
    if (header.alg !== "RS256" || !header.kid || claims.aud !== clientId ||
      !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss || "") ||
      !claims.sub || !claims.email || claims.email_verified !== true ||
      !claims.exp || claims.exp <= Math.floor(Date.now() / 1000) ||
      !claims.iat || claims.iat > Math.floor(Date.now() / 1000) + 60) return null;

    const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
    if (!response.ok) return null;
    const jwks = await response.json() as { keys?: JsonWebKey[] };
    const jwk = jwks.keys?.find((key) => (key as JsonWebKey & { kid?: string }).kid === header.kid);
    if (!jwk) return null;
    const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, decodePart(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
    return valid ? claims : null;
  } catch { return null; }
}

export const onRequestPost = async ({ request, env }: AppContext) => {
  if (!validSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.GOOGLE_CLIENT_ID) return json({ error: "Google sign-in is not configured on the server." }, 503);

  const ipHash = await sha256("google-auth:" + (request.headers.get("CF-Connecting-IP") || "unknown"));
  await env.DB.prepare(`INSERT INTO auth_rate_limits (bucket_hash, hits, window_started_at) VALUES (?, 1, unixepoch())
    ON CONFLICT(bucket_hash) DO UPDATE SET
      hits = CASE WHEN window_started_at <= unixepoch() - 900 THEN 1 ELSE hits + 1 END,
      window_started_at = CASE WHEN window_started_at <= unixepoch() - 900 THEN unixepoch() ELSE window_started_at END`).bind(ipHash).run();
  const rate = await env.DB.prepare("SELECT hits FROM auth_rate_limits WHERE bucket_hash = ?").bind(ipHash).first<{ hits: number }>();
  if ((rate?.hits || 0) > 20) return json({ error: "Too many sign-in attempts. Please wait and try again." }, 429);

  let body: { credential?: string };
  try { body = await request.json() as { credential?: string }; } catch { return json({ error: "Invalid JSON body." }, 400); }
  const credential = body.credential;
  if (!credential || credential.length > 10000) return json({ error: "A valid Google credential is required." }, 400);
  const claims = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID);
  if (!claims) return json({ error: "The Google sign-in credential is invalid or expired." }, 401);

  const email = claims.email!.toLowerCase();
  const linked = await env.DB.prepare("SELECT user_id FROM google_identities WHERE google_sub = ?").bind(claims.sub!).first<{ user_id: string }>();
  let userId = linked?.user_id;
  if (!userId) {
    const existing = await env.DB.prepare("SELECT id FROM student_profiles WHERE email = ? COLLATE NOCASE").bind(email).first<{ id: string }>();
    userId = existing?.id || crypto.randomUUID();
    if (!existing) {
      await env.DB.prepare("INSERT INTO student_profiles (id, email, password_salt, password_hash, full_name, school, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '', '', unixepoch(), unixepoch())")
        .bind(userId, email, randomHex(16), randomHex(32), claims.name || "ClerkMe user").run();
    }
    await env.DB.prepare("INSERT INTO google_identities (google_sub, user_id, created_at) VALUES (?, ?, unixepoch())").bind(claims.sub!, userId).run();
  }

  const sessionToken = randomHex(32);
  const sessionHash = await sha256(sessionToken);
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, unixepoch() + 604800, unixepoch())")
    .bind(sessionHash, userId).run();
  const user = await env.DB.prepare("SELECT id, email, full_name AS name, NULL AS picture, 'student' AS role FROM student_profiles WHERE id = ?").bind(userId).first();
  return json({ user }, 200, { "Set-Cookie": cookieHeader(sessionToken, 60 * 60 * 24 * 7) });
};
