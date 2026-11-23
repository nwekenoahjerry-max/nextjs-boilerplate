import type { Env, D1Database } from "./auth";
import { sha256 } from "./auth";

export type EmailActionPurpose = "verify_email" | "password_reset";
// Cloudflare Workers currently enforces a 100,000-iteration PBKDF2 ceiling.
// Keep this at the runtime-supported maximum; raise it only with a different KDF/runtime.
const PASSWORD_ITERATIONS = 100000;

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array {
  const result = new Uint8Array(value.length / 2);
  for (let i = 0; i < result.length; i++) result[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return result;
}

function toHex(value: Uint8Array): string {
  return Array.from(value, b => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBytes = fromHex(saltHex);
  const saltBuffer = new ArrayBuffer(saltBytes.byteLength);
  new Uint8Array(saltBuffer).set(saltBytes);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations: PASSWORD_ITERATIONS },
    key,
    256
  );
  return "pbkdf2_sha256$" + PASSWORD_ITERATIONS + "$" + toHex(new Uint8Array(bits));
}

export async function verifyPassword(password: string, saltHex: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "pbkdf2_sha256" || Number(parts[1]) !== PASSWORD_ITERATIONS || !/^[a-f0-9]{64}$/i.test(parts[2])) {
    return false;
  }
  const actual = await hashPassword(password, saltHex);
  const expected = parts[0] + "$" + parts[1] + "$" + parts[2].toLowerCase();
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

export async function checkAuthRateLimit(
  db: D1Database,
  request: Request,
  action: string,
  maxHits: number,
  windowSeconds: number,
  identity?: string
): Promise<boolean> {
  const source = identity || request.headers.get("CF-Connecting-IP") || "unknown";
  const bucketHash = await sha256("clerkme-auth:" + action + ":" + source.toLowerCase());
  await db.prepare(
    "INSERT INTO auth_rate_limits (bucket_hash, hits, window_started_at) VALUES (?, 1, unixepoch()) " +
    "ON CONFLICT(bucket_hash) DO UPDATE SET " +
    "hits = CASE WHEN window_started_at <= unixepoch() - ? THEN 1 ELSE hits + 1 END, " +
    "window_started_at = CASE WHEN window_started_at <= unixepoch() - ? THEN unixepoch() ELSE window_started_at END"
  ).bind(bucketHash, windowSeconds, windowSeconds).run();
  const row = await db.prepare("SELECT hits FROM auth_rate_limits WHERE bucket_hash = ?").bind(bucketHash).first<{ hits: number }>();
  return (row?.hits || 0) <= maxHits;
}

export async function createEmailActionToken(
  db: D1Database,
  userId: string,
  purpose: EmailActionPurpose,
  lifetimeSeconds: number
): Promise<string> {
  await db.prepare(
    "UPDATE email_action_tokens SET consumed_at = unixepoch() WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL"
  ).bind(userId, purpose).run();
  const token = randomHex(32);
  await db.prepare(
    "INSERT INTO email_action_tokens (token_hash, user_id, purpose, expires_at, created_at) VALUES (?, ?, ?, unixepoch() + ?, unixepoch())"
  ).bind(await sha256(token), userId, purpose, lifetimeSeconds).run();
  return token;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character] || character);
}

export async function sendAuthEmail(
  env: Env,
  request: Request,
  recipient: string,
  purpose: EmailActionPurpose,
  token: string
): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured for this environment.");
  const origin = new URL(request.url).origin;
  const route = purpose === "verify_email" ? "/verify-email/" : "/reset-password/";
  const actionUrl = new URL(route, origin);
  actionUrl.searchParams.set("token", token);

  const isVerification = purpose === "verify_email";
  const heading = isVerification ? "Verify your email address" : "Reset your ClerkMe password";
  const explanation = isVerification
    ? "Confirm this email address to activate your ClerkMe account. This link expires in 24 hours."
    : "Use the secure link below to choose a new password. This link expires in 1 hour.";
  const button = isVerification ? "Verify email address" : "Reset my password";
  const safeUrl = escapeHtml(actionUrl.toString());
  // Use the production PNG mark: raster logos are more consistently rendered
  // by email clients than SVG images.
  const logoUrl = "https://clerkme.com.ng/clerkme-192.png";
  const safeLogoUrl = escapeHtml(logoUrl);
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#f2f5fa;font-family:Arial,Helvetica,sans-serif;color:#18304f">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' + escapeHtml(heading) + ' — secure account access from ClerkMe.</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f2f5fa;border-collapse:collapse">' +
    '<tr><td align="center" style="padding:36px 14px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e1e8f1;border-radius:18px;overflow:hidden">' +
    '<tr><td style="padding:26px 30px;background:#102d5a">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>' +
    '<td valign="middle" style="padding-right:15px">' +
    '<img src="' + safeLogoUrl + '" width="68" height="68" alt="ClerkMe logo" style="display:block;width:68px;height:68px;border:0;border-radius:15px;outline:none;text-decoration:none">' +
    '</td><td valign="middle">' +
    '<div style="font-size:25px;line-height:1.2;font-weight:800;letter-spacing:-.5px;color:#ffffff">ClerkMe</div>' +
    '<div style="padding-top:5px;font-size:10px;line-height:1.5;font-weight:700;letter-spacing:1.5px;color:#dbe7f7">CLINICAL LEARNING WORKSPACE</div>' +
    '</td></tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding:38px 34px 30px">' +
    '<p style="margin:0 0 12px;font-size:13px;line-height:1.5;font-weight:700;letter-spacing:.4px;color:#6b7d95">HELLO FROM CLERKME</p>' +
    '<h1 style="margin:0 0 14px;font-size:27px;line-height:1.25;font-weight:800;letter-spacing:-.5px;color:#102d5a">' + heading + '</h1>' +
    '<p style="margin:0 0 24px;font-size:15px;line-height:1.75;color:#53657d">' + explanation + '</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;border-collapse:collapse"><tr><td align="center" bgcolor="#102d5a" style="border-radius:9px;background:#102d5a">' +
    '<a href="' + safeUrl + '" style="display:inline-block;padding:15px 25px;border:1px solid #102d5a;border-radius:9px;background:#102d5a;color:#ffffff;text-decoration:none;font-size:15px;line-height:1.2;font-weight:700">' + button + '</a>' +
    '</td></tr></table>' +
    '<div style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#6b7d95;font-weight:700">Having trouble with the button?</div>' +
    '<p style="margin:0;font-size:12px;line-height:1.7;color:#718198">Copy and paste this secure link into your browser:</p>' +
    '<p style="margin:7px 0 0;font-size:12px;line-height:1.7;word-break:break-all"><a href="' + safeUrl + '" style="color:#2456a6;text-decoration:underline">' + safeUrl + '</a></p>' +
    '<div style="height:1px;margin:28px 0 20px;background:#e8edf4;font-size:0;line-height:0">&nbsp;</div>' +
    '<p style="margin:0;font-size:12px;line-height:1.75;color:#7a8799">Security note: If you did not request this email, you can safely ignore it. Never share this link with anyone.</p>' +
    '</td></tr>' +
    '<tr><td align="center" style="padding:19px 24px;background:#f8fafd;border-top:1px solid #edf1f6">' +
    '<p style="margin:0;font-size:11px;line-height:1.7;color:#8491a3">ClerkMe · Your clinical learning workspace<br><a href="https://clerkme.com.ng" style="color:#2456a6;text-decoration:none">clerkme.com.ng</a></p>' +
    '</td></tr></table>' +
    '<p style="margin:18px 0 0;font-size:10px;line-height:1.5;color:#9aa5b3">This is an automated account-security message.</p>' +
    '</td></tr></table></body></html>';

  const text = "ClerkMe\\n" + heading + "\\n\\n" + explanation + "\\n\\n" + button + ": " + actionUrl.toString() +
    "\\n\\nIf you did not request this email, ignore it. Never share this link with anyone.\\n\\nClerkMe · Your clinical learning workspace\\nhttps://clerkme.com.ng";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID()
    },
    body: JSON.stringify({
      from: "ClerkMe Accounts <accounts@mail.clerkme.com.ng>",
      to: [recipient],
      subject: isVerification ? "Welcome to ClerkMe — verify your email" : "Reset your ClerkMe password",
      html,
      text
    })
  });
  if (!response.ok) {
    console.error("[clerkme-auth] Resend email request failed with status", response.status);
    throw new Error("The account email could not be sent.");
  }
}
