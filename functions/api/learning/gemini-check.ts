import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

const MODEL = "gemini-3.8-flash";

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;

  const apiKey = context.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ ok: false, code: "GEMINI_KEY_MISSING", error: "GEMINI_API_KEY is not configured in the production Cloudflare environment." }, 503);
  }

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Api-Revision": "2026-05-20",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        model: MODEL,
        input: "Reply with exactly this text and nothing else: CLERKME_GEMINI_OK",
        store: false,
        generation_config: { max_output_tokens: 24, thinking_level: "low" }
      }),
      signal: AbortSignal.timeout(25000)
    });
    const data = await response.json().catch(() => ({})) as {
      status?: string;
      steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
      error?: { message?: string; status?: string };
    };

    if (!response.ok) {
      const detail = typeof data.error?.message === "string" ? data.error.message.slice(0, 500) : "";
      if (response.status === 401 || response.status === 403) {
        return json({ ok: false, code: "GEMINI_KEY_OR_PERMISSION_ERROR", error: "Google rejected the Gemini key or its permissions. Check that the key belongs to the intended Google Cloud project and that the Generative Language API is enabled. " + detail }, 502);
      }
      if (response.status === 429) {
        return json({ ok: false, code: "GEMINI_QUOTA_LIMIT", error: "The Gemini API key is recognised, but its current quota or rate limit has been reached. Check Google AI Studio → Usage." }, 429);
      }
      return json({ ok: false, code: "GEMINI_TEST_FAILED", error: "Gemini returned HTTP " + response.status + ". " + detail }, 502);
    }

    const output = (data.steps || [])
      .filter(step => step.type === "model_output")
      .flatMap(step => (step.content || []).filter(part => part.type === "text").map(part => part.text || ""))
      .join("\n")
      .trim();
    if (!output || data.status === "incomplete" || data.status === "budget_exceeded") {
      return json({ ok: false, code: "GEMINI_NO_OUTPUT", error: "Google accepted the request but did not return a completed text response. Provider status: " + (data.status || "unknown") + "." }, 502);
    }

    return json({
      ok: true,
      model: MODEL,
      status: data.status || "completed",
      message: "Gemini is connected and returned a successful test response."
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const timedOut = /abort|timeout/i.test(detail);
    return json({
      ok: false,
      code: timedOut ? "GEMINI_TEST_TIMEOUT" : "GEMINI_NETWORK_ERROR",
      error: timedOut ? "The Gemini test request timed out. Check the provider status and try again." : "ClerkMe could not reach the Gemini API. " + detail.slice(0, 300)
    }, 502);
  }
};
