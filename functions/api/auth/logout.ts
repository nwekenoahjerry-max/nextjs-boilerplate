import { clearSessionCookie, json, requireUser, type AppContext } from "../../_lib/auth";
export const onRequestPost = async ({ request, env }: AppContext) => {
  const cookie = request.headers.get("Cookie") || "";
  const token = cookie.split(";").map(v => v.trim()).find(v => v.startsWith("__Host-clerkme_session="))?.slice("__Host-clerkme_session=".length);
  if (token) {
    const { sha256 } = await import("../../_lib/auth");
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(decodeURIComponent(token))).run();
  }
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
};
