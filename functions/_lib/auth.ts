export interface WorkersAI {
  run(model: string, input: Record<string, unknown>, options?: { rejectIfBusy?: boolean }): Promise<unknown>;
}
export interface R2StoredObject {
  body: ReadableStream;
  size: number;
  httpMetadata?: { contentType?: string };
}
export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }
  ): Promise<unknown>;
  get(key: string): Promise<R2StoredObject | null>;
  delete(key: string): Promise<void>;
}
export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  RESEND_API_KEY?: string;
  CRON_TOKEN?: string;
  VAPID_PUBLIC_KEY?: string;
  CLERKME_ADMIN_EMAILS?: string;
  YOUTUBE_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ZAI_API_KEY?: string;
  SOURCE_FILES?: R2BucketLike;
  AI?: WorkersAI;
}
export interface AppUser {
  id: string; email: string; name: string; picture: string | null; role: string;
  university: string; country: string; level: string; futureSpecialty: string; state: string; lga: string;
  profileComplete: number;
}
export interface D1Database { prepare(sql: string): D1PreparedStatement; }
export interface D1PreparedStatement { bind(...values: unknown[]): D1PreparedStatement; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }>; run(): Promise<unknown>; }
export interface AppContext { request: Request; env: Env; params: Record<string, string>; waitUntil?: (promise: Promise<unknown>) => void; }
const SESSION_COOKIE = "__Host-clerkme_session";
export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
}
export function cookieHeader(token: string, maxAge: number) { return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
export function clearSessionCookie() { return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
export function hasAdminAccess(email: string, env: Pick<Env, "CLERKME_ADMIN_EMAILS">): boolean {
  const allowed = (env.CLERKME_ADMIN_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
export async function requireUser(context: AppContext): Promise<AppUser | Response> {
  const cookie = context.request.headers.get("Cookie") || "";
  const token = cookie.split(";").map(v => v.trim()).find(v => v.startsWith(SESSION_COOKIE + "="))?.slice(SESSION_COOKIE.length + 1);
  if (!token) return json({ error: "Authentication required." }, 401);
  let decoded: string; try { decoded = decodeURIComponent(token); } catch { return json({ error: "Invalid session." }, 401); }
  const tokenHash = await sha256(decoded);
  const row = await context.env.DB.prepare(`
    SELECT p.id, p.email, p.full_name AS name, NULL AS picture, 'student' AS role,
      p.school AS university, p.country, p.level, p.future_specialty AS futureSpecialty, p.state, p.lga,
      CASE WHEN LENGTH(TRIM(COALESCE(p.full_name,''))) >= 2
        AND LENGTH(TRIM(COALESCE(p.school,''))) >= 2
        AND LENGTH(TRIM(COALESCE(p.country,''))) >= 2
        AND LENGTH(TRIM(COALESCE(p.level,''))) >= 1
        AND LENGTH(TRIM(COALESCE(p.state,''))) >= 1
        AND LENGTH(TRIM(COALESCE(p.lga,''))) >= 1
      THEN 1 ELSE 0 END AS profileComplete
    FROM sessions s JOIN student_profiles p ON p.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > unixepoch()
  `).bind(tokenHash).first<AppUser>();
  if (!row) return json({ error: "Session expired. Please sign in again." }, 401, { "Set-Cookie": clearSessionCookie() });
  if (hasAdminAccess(row.email, context.env)) row.role = "admin";
  return row;
}
export async function requireAdmin(context: AppContext): Promise<AppUser | Response> {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  if (user.role !== "admin") return json({ error: "This account is not authorised to access the ClerkME admin console." }, 403);
  return user;
}
export function aiFailureResponse(error: unknown, fallback: string): Response {
  const detail = typeof error === "string" ? error
    : error instanceof Error ? error.message
    : error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message ?? "")
    : "";
  const dailyLimitReached = /4006|daily free allocation|10,000 neurons|used up.{0,80}(?:neurons|quota|allocation)|(?:neurons|quota|allocation).{0,80}(?:daily|limit|exhausted)/i.test(detail);
  if (dailyLimitReached) {
    return json({
      error: "ClerkMe's AI service has reached its daily usage allowance. Your saved materials are safe. Please try again after the allowance resets.",
      code: "AI_DAILY_LIMIT"
    }, 429);
  }
  return json({
    error: fallback,
    code: "AI_TEMPORARILY_UNAVAILABLE"
  }, 502);
}
export function isResponse(value: AppUser | Response): value is Response { return value instanceof Response; }
export function validSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}
export async function writeAudit(db: D1Database, userId: string, action: string, caseId: string | null, request: Request) {
  await db.prepare("INSERT INTO audit_events (id, user_id, action, case_id, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))")
    .bind(crypto.randomUUID(), userId, action, caseId, await sha256(request.headers.get("CF-Connecting-IP") || "unknown")).run();
}
export const MAX_CASE_TEXT = 20000;
