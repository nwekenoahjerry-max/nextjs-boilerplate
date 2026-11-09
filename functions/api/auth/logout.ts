import { clearSessionCookie, json, sha256, validSameOrigin, type AppContext } from "../../_lib/auth";
export const onRequestPost = async ({ request, env }: AppContext) => {
  if (!validSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const cookie = request.headers.get("Cookie") || "";
  const token = cookie.split(";").map(v => v.trim()).find(v => v.startsWith("__Host-clerkme_session="))?.slice("__Host-clerkme_session=".length);
  if (token) {
    try { await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(decodeURIComponent(token))).run(); } catch { /* Always clear the browser cookie. */ }
  }
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
};
