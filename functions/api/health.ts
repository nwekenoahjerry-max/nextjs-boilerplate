import { json, type AppContext } from "../_lib/auth";

export const onRequestGet = async ({ env }: AppContext) => {
  // Report availability only; never return secret values or configuration contents.
  const integrations = {
    videoSearch: Boolean(env.YOUTUBE_API_KEY?.trim()),
    detailedAI: Boolean(env.GEMINI_API_KEY?.trim()),
    fallbackAI: Boolean(env.ZAI_API_KEY?.trim()),
    email: Boolean(env.RESEND_API_KEY?.trim()),
    sourceFiles: Boolean(env.SOURCE_FILES),
    statusMedia: Boolean(env.STATUS_MEDIA),
    chatRooms: Boolean(env.CHAT_ROOMS),
    workersAI: Boolean(env.AI)
  };

  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return json({ status: "ok", service: "ClerkMe API", database: "connected", integrations });
  } catch {
    return json({ status: "error", service: "ClerkMe API", database: "unavailable", integrations }, 503);
  }
};
