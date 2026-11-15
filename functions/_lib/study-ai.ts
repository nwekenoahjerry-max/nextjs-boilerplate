import type { AppContext } from "./auth";

export const STUDY_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const cleanText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export function parseAIObject(value: unknown): Record<string, unknown> {
  const outer = value as { response?: unknown; result?: { response?: unknown } };
  let raw = outer?.response ?? outer?.result?.response ?? value;
  if (typeof raw === "object" && raw !== null) return raw as Record<string, unknown>;
  if (typeof raw !== "string") throw new Error("The AI service returned an unexpected response.");
  let text = raw.trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/i, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  return JSON.parse(text) as Record<string, unknown>;
}

export async function runStudyAI(context: AppContext, system: string, user: string, maxTokens: number) {
  if (!context.env.AI) throw new Error("The AI engine is not connected. Check that the Cloudflare Workers AI binding named AI is configured for this deployment.");
  const result = await context.env.AI.run(STUDY_AI_MODEL, {
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    response_format: { type: "json_object" },
    max_tokens: maxTokens
  });
  return parseAIObject(result);
}
