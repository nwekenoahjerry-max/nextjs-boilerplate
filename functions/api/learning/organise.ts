import { json, requireUser, isResponse, validSameOrigin, aiFailureResponse, type AppContext } from "../../_lib/auth";
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
function parseAIResult(value: unknown): Record<string, unknown> {
  const outer = value as { response?: unknown; result?: { response?: unknown } };
  let raw = outer?.response ?? outer?.result?.response ?? value;
  if (typeof raw === "object" && raw !== null) return raw as Record<string, unknown>;
  if (typeof raw !== "string") throw new Error("The AI service returned an unexpected response.");
  let text = raw.trim().replace(/^\u0060{3}(?:json)?\s*/i, "").replace(/\s*\u0060{3}$/i, "");
  const start = text.indexOf("{"); const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  return JSON.parse(text) as Record<string, unknown>;
}
export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context); if (isResponse(user)) return user;
  if (!context.env.AI) return json({ error: "The AI engine is not connected yet. Add a Workers AI binding named AI to the ClerkMe Pages project, then redeploy." }, 503);
  let body: Record<string, unknown>;
  try { body = await context.request.json() as Record<string, unknown>; } catch { return json({ error: "Invalid request body." }, 400); }
  const notes = clean(body.notes, 30000);
  const unit = clean(body.unit, 80) || "general-medicine";
  const complaint = clean(body.complaint, 300);
  if (notes.length < 30) return json({ error: "Add or upload the student's raw clerking notes first." }, 400);
  try {
    const result = await context.env.AI.run(MODEL, {
      messages: [
        { role: "system", content: "You are a meticulous senior clinical educator and medical documentation assistant. Convert rough student clerking notes into a clear, coherent, professional clinical history in British English. Preserve every supplied fact and the student's meaning. Never invent age, sex, dates, duration, symptoms, examination findings, negatives, diagnoses, investigations, treatment, or patient identifiers. Do not turn missing information into normal findings. Where important details are absent, explicitly mark them as 'not documented' or list them as follow-up questions. Do not infer a diagnosis from incomplete notes. Preserve uncertainty and contradictory source details, flagging contradictions instead of resolving them. Use appropriate headings and polished prose. Return valid JSON only." },
        { role: "user", content: `Clinical unit: ${unit}. Presenting complaint if known: ${complaint || "Not separately provided"}.
Organise these rough notes into:
1. A polished history in connected prose with appropriate clinical headings.
2. A concise list of missing information / follow-up questions.
3. A short list of details that were unclear or contradictory.
Keep examination and assessment separate if present in the notes. Do not fabricate.
STUDENT NOTES:
---
${notes}
---` }
      ],
      response_format: { type: "json_object" },
      max_tokens: 7000
    });
    const parsed = parseAIResult(result);
    const prose = clean(parsed.prose ?? parsed.organisedHistory ?? parsed.history, 18000);
    const missing = Array.isArray(parsed.missingInformation) ? parsed.missingInformation.map(x=>clean(x,500)).filter(Boolean).slice(0,30) : [];
    const unclear = Array.isArray(parsed.unclearOrContradictory) ? parsed.unclearOrContradictory.map(x=>clean(x,500)).filter(Boolean).slice(0,20) : [];
    if (!prose) throw new Error("The AI did not return an organised history. Please try again with clearer notes.");
    return json({ prose, missingInformation: missing, unclearOrContradictory: unclear });
  } catch (error) {
    return aiFailureResponse(error, "Clerking-note organisation is temporarily unavailable. Please try again later.");
  }
};
