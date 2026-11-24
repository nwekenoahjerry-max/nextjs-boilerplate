import { json, type AppContext } from "../../../_lib/auth";

// Only the scheduled Worker knows the matching 256-bit bearer token.
const CRON_TOKEN_SHA256 = "7bc5c1f53cd16a432e8d2e3426ef92d1a1964663dca73a18343d1cea255084f4";
const encoder = new TextEncoder();
async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function escapeHtml(value: string) {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  return value.replace(/[&<>"]/g, character => map[character] || character);
}

export const onRequestPost = async ({ request, env }: AppContext) => {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || !safeEqual(await sha256Hex(token), CRON_TOKEN_SHA256)) return json({ error: "Not found." }, 404);
  if (!env.RESEND_API_KEY) return json({ error: "Email delivery is not configured." }, 503);

  const due = await env.DB.prepare("SELECT id, email, full_name, last_seen_at FROM student_profiles WHERE email_verified_at IS NOT NULL AND email_reminders_enabled = 1 AND last_seen_at IS NOT NULL AND last_seen_at <= unixepoch() - 172800 AND (email_reminder_sent_at IS NULL OR email_reminder_sent_at < last_seen_at) ORDER BY last_seen_at ASC LIMIT 100")
    .all<{ id: string; email: string; full_name: string; last_seen_at: number }>();
  let sent = 0, failed = 0;
  for (const student of due.results) {
    try {
      const current = await env.DB.prepare("SELECT last_seen_at, email_reminders_enabled FROM student_profiles WHERE id = ?").bind(student.id).first<{ last_seen_at: number; email_reminders_enabled: number }>();
      if (!current || current.last_seen_at !== student.last_seen_at || current.email_reminders_enabled !== 1) continue;
      const firstName = (student.full_name || "there").trim().split(/\\s+/)[0].slice(0, 50) || "there";
      const safeName = escapeHtml(firstName);
      const actionUrl = "https://clerkme.com.ng/";
      const html =
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
        '<body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#193354">' +
        '<div style="display:none;max-height:0;overflow:hidden;opacity:0">A little note from your ClerkMe study companion. We have missed you.</div>' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f3f6fb"><tr><td align="center" style="padding:34px 14px">' +
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid #e0e8f2;border-radius:20px;overflow:hidden">' +
        '<tr><td style="padding:25px 30px;background:#102d5a;color:#fff;font-size:24px;font-weight:800">ClerkMe <span style="color:#a9c9f4">♥</span><div style="padding-top:5px;font-size:10px;letter-spacing:1.4px;color:#dbe7f7">YOUR CLINICAL LEARNING COMPANION</div></td></tr>' +
        '<tr><td style="padding:38px 34px 30px"><p style="margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:1.5px;color:#6380a3">JUST A LITTLE NOTE FROM US</p>' +
        '<h1 style="margin:0 0 17px;font-size:28px;line-height:1.25;color:#102d5a">We have missed you, ' + safeName + '. 💙</h1>' +
        '<p style="margin:0 0 17px;font-size:15px;line-height:1.8;color:#4d617b">It has been a little quieter around your ClerkMe corner, and we wanted to send a small hello. Your study space has been right here, keeping your place warm for you.</p>' +
        '<div style="margin:23px 0;padding:18px 19px;border:1px solid #dce8f8;border-radius:13px;background:#f5f8ff"><p style="margin:0 0 7px;font-size:14px;line-height:1.7;font-weight:700;color:#183b69">Your next little win is waiting. ✨</p><p style="margin:0;font-size:13px;line-height:1.75;color:#536a86">A quick revision, one clinical case, or just ten quiet minutes with a topic. You do not have to catch up on everything today. Start wherever you are.</p></div>' +
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 22px"><tr><td align="center" bgcolor="#174b91" style="border-radius:10px"><a href="' + actionUrl + '" style="display:inline-block;padding:15px 25px;border-radius:10px;background:#174b91;color:#fff;text-decoration:none;font-size:14px;font-weight:750">Come back to ClerkMe →</a></td></tr></table>' +
        '<p style="margin:0 0 5px;font-size:13px;line-height:1.75;color:#536a86">No pressure, no guilt. We are simply happy whenever you come by.</p><p style="margin:22px 0 0;font-size:14px;line-height:1.75;color:#29496e">With a little warmth,<br><strong>Your ClerkMe study companion 💙</strong></p></td></tr>' +
        '<tr><td align="center" style="padding:20px 24px;background:#f8fafd;border-top:1px solid #edf1f6"><p style="margin:0;font-size:11px;line-height:1.8;color:#8491a3">ClerkMe · Your clinical learning workspace<br><a href="https://clerkme.com.ng" style="color:#2456a6;text-decoration:none">clerkme.com.ng</a><br>Manage email reminders in Account &amp; settings.</p></td></tr></table></td></tr></table></body></html>';
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json", "Idempotency-Key": "clerkme-reengagement-" + student.id + "-" + student.last_seen_at },
        body: JSON.stringify({ from: "ClerkMe Accounts <accounts@mail.clerkme.com.ng>", to: [student.email], subject: "A little note: ClerkMe has missed you 💙", html })
      });
      if (!response.ok) { failed++; console.error("[clerkme-reminders] Email provider rejected a reminder.", response.status); continue; }
      await env.DB.prepare("UPDATE student_profiles SET email_reminder_sent_at = unixepoch() WHERE id = ? AND last_seen_at = ? AND email_reminders_enabled = 1").bind(student.id, student.last_seen_at).run();
      sent++;
    } catch (error) { failed++; console.error("[clerkme-reminders] Email reminder failed.", error instanceof Error ? error.message : "unknown error"); }
  }
  return json({ processed: due.results.length, sent, failed });
};
