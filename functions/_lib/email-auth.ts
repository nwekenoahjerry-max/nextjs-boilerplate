import type { Env, D1Database } from "./auth";
import { sha256 } from "./auth";

export type EmailActionPurpose = "verify_email" | "password_reset";
const PASSWORD_ITERATIONS = 600000;

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
  const html =
    '<div style="margin:0;padding:36px 16px;background:#f4f7fb;font-family:Arial,sans-serif;color:#102d5a">' +
    '<div style="max-width:520px;margin:0 auto;padding:34px 30px;background:#ffffff;border:1px solid #e4eaf2;border-radius:16px">' +
    '<div style="font-size:12px;font-weight:800;letter-spacing:2px;color:#102d5a">CLERKME</div>' +
    '<h1 style="margin:26px 0 12px;font-size:25px;line-height:1.25;color:#102d5a">' + heading + '</h1>' +
    '<p style="font-size:15px;line-height:1.7;color:#51627a">' + explanation + '</p>' +
    '<p style="margin:28px 0"><a href="' + safeUrl + '" style="display:inline-block;padding:14px 22px;border-radius:8px;background:#102d5a;color:#ffffff;text-decoration:none;font-weight:700">' + button + '</a></p>' +
    '<p style="font-size:12px;line-height:1.7;color:#68778c">If the button does not work, copy this link into your browser:<br><a href="' + safeUrl + '" style="color:#2456a6;word-break:break-all">' + safeUrl + '</a></p>' +
    '<hr style="border:0;border-top:1px solid #e8edf4;margin:26px 0">' +
    '<p style="font-size:11px;line-height:1.7;color:#7b8798">If you did not request this, you can ignore this email. Never share this link with anyone.</p>' +
    '</div></div>';

  const text = heading + "\n\n" + explanation + "\n\n" + actionUrl.toString() +
    "\n\nIf you did not request this, ignore this email. Never share this link with anyone.";

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
      subject: isVerification ? "Verify your ClerkMe email address" : "Reset your ClerkMe password",
      html,
      text
    })
  });
  if (!response.ok) {
    console.error("[clerkme-auth] Resend email request failed with status", response.status);
    throw new Error("The account email could not be sent.");
  }
}
