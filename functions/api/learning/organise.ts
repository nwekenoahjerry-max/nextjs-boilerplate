import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";
import { cleanText as clean, runStudyAI } from "../../_lib/study-ai";

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context); if (isResponse(user)) return user;
  let body: Record<string, unknown>;
  try { body = await context.request.json() as Record<string, unknown>; } catch { return json({ error: "Invalid request body." }, 400); }
  const notes = clean(body.notes, 30000);
  const unit = clean(body.unit, 80) || "general-medicine";
  const complaint = clean(body.complaint, 300);
  if (notes.length < 30) return json({ error: "Add or upload the student's raw clerking notes first." }, 400);
  try {
    const parsed = await runStudyAI(context,
      "You are a meticulous senior clinical educator and medical documentation assistant. Convert rough student clerking notes into a clear, coherent, professional clinical history in British English. Preserve every supplied fact and the student's meaning. Never invent age, sex, dates, duration, symptoms, examination findings, negatives, diagnoses, investigations, treatment, or patient identifiers. Do not turn missing information into normal findings. Where important details are absent, explicitly mark them as 'not documented' or list them as follow-up questions. Do not infer a diagnosis from incomplete notes. Preserve uncertainty and contradictory source details, flagging contradictions instead of resolving them. Use appropriate headings and polished prose. Return valid JSON only.",
      "Clinical unit: " + unit + ". Presenting complaint if known: " + (complaint || "Not separately provided") + ".\nOrganise these rough notes into: (1) polished history in connected prose with appropriate clinical headings; (2) concise missing information/follow-up questions; (3) short list of unclear or contradictory details. Keep examination and assessment separate if present. Do not fabricate.\nSTUDENT NOTES:\n---\n" + notes + "\n---",
      7000
    );
    const prose = clean(parsed.prose ?? parsed.organisedHistory ?? parsed.history, 18000);
    const missing = Array.isArray(parsed.missingInformation) ? parsed.missingInformation.map(x => clean(x, 500)).filter(Boolean).slice(0, 30) : [];
    const unclear = Array.isArray(parsed.unclearOrContradictory) ? parsed.unclearOrContradictory.map(x => clean(x, 500)).filter(Boolean).slice(0, 20) : [];
    if (!prose) throw new Error("The AI did not return an organised history. Please try again with clearer notes.");
    return json({ prose, missingInformation: missing, unclearOrContradictory: unclear });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not organise the clerking notes." }, 502);
  }
};
