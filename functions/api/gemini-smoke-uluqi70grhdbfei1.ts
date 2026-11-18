type SmokeEnv = { GEMINI_API_KEY?: string };
type SmokeContext = { env: SmokeEnv };
export const onRequestGet = async ({ env }: SmokeContext) => {
  if (!env.GEMINI_API_KEY) return Response.json({ ok: false, code: "GEMINI_API_KEY_MISSING" }, { status: 503 });
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with exactly this text and nothing else: CLERKME_GEMINI_OK" }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 24 }
      }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await response.json().catch(() => ({})) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      error?: { message?: string; status?: string; code?: number };
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };
    if (!response.ok) return Response.json({
      ok: false, model: "gemini-3.1-flash-lite", httpStatus: response.status,
      providerStatus: data.error?.status || "UNKNOWN",
      message: (data.error?.message || "Gemini rejected the request.").slice(0, 250)
    }, { status: 502 });
    const output = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim() || "";
    return Response.json({
      ok: output === "CLERKME_GEMINI_OK", model: "gemini-3.1-flash-lite",
      responseMatched: output === "CLERKME_GEMINI_OK", usage: data.usageMetadata || null
    });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message.slice(0, 180) : "Gemini request failed." }, { status: 502 });
  }
};
