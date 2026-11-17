import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

const MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.6-flash";
const TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);

type GeminiCheckData = {
  status?: string;
  steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string; status?: string };
};

async function testModel(apiKey: string, model: string): Promise<{ response: Response; data: GeminiCheckData }> {
  let last: { response: Response; data: GeminiCheckData } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Api-Revision": "2026-05-20",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        model,
        input: "Reply with exactly this text and nothing else: CLERKME_GEMINI_OK",
        store: false,
        generation_config: { max_output_tokens: 24, thinking_level: "low" }
      }),
      signal: AbortSignal.timeout(25000)
    });
    const data = await response.json().catch(() => ({})) as GeminiCheckData;
    last = { response, data };
    if (response.ok || !TRANSIENT_STATUSES.has(response.status) || attempt === 1) return last;
    await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
  }
  if (last) return last;
  throw new Error("Gemini diagnostic did not complete.");
}

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;

  const apiKey = context.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ ok: false, code: "GEMINI_KEY_MISSING", error: "GEMINI_API_KEY is not configured in the production Cloudflare environment." }, 503);
  }

  try {
    let activeModel = MODEL;
    let tested = await testModel(apiKey, MODEL);
    let fallbackUsed = false;
    if (!tested.response.ok && TRANSIENT_STATUSES.has(tested.response.status)) {
      fallbackUsed = true;
      activeModel = FALLBACK_MODEL;
      tested = await testModel(apiKey, FALLBACK_MODEL);
    }

    const { response, data } = tested;
    if (!response.ok) {
      const detail = typeof data.error?.message === "string" ? data.error.message.slice(0, 500) : "";
      if (response.status === 401 || response.status === 403) {
        return json({ ok: false, code: "GEMINI_KEY_OR_PERMISSION_ERROR", error: "Google rejected the Gemini key or its permissions. Check that the key belongs to the intended Google Cloud project and that the Generative Language API is enabled. " + detail }, 502);
      }
      if (response.status === 429) {
        return json({ ok: false, code: "GEMINI_QUOTA_LIMIT", error: "The Gemini API key is recognised, but its current quota or rate limit has been reached. Check Google AI Studio → Usage." }, 429);
      }
      if (TRANSIENT_STATUSES.has(response.status)) {
        return json({ ok: false, code: "GEMINI_PROVIDER_UNAVAILABLE", retryable: true, error: "Google's Gemini service is temporarily overloaded. ClerkMe retried and tested a second Gemini model, but neither could respond just now. Your material is safe; please try again shortly." }, 502);
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
      model: activeModel,
      fallbackUsed,
      status: data.status || "completed",
      message: fallbackUsed
        ? "Gemini is connected. The primary model was busy, so ClerkMe successfully used its backup Gemini model."
        : "Gemini is connected and returned a successful test response."
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
