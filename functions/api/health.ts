import { json, type AppContext } from "../_lib/auth";
export const onRequestGet = async ({ env }: AppContext) => {
  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return json({ status: "ok", service: "ClerkMe API", database: "connected" });
  } catch {
    return json({ status: "error", service: "ClerkMe API", database: "unavailable" }, 503);
  }
};
