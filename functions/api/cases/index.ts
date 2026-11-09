import { json, requireUser, isResponse, validSameOrigin, writeAudit, type AppContext, MAX_CASE_TEXT } from "../../_lib/auth";
const allowedSpecialties = new Set(["general-medicine", "paediatrics", "obstetrics-gynaecology", "surgery", "emergency", "other"]);
const section = (value: unknown) => {
  if (value === undefined) return "{}";
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Each clerking section must be a structured object.");
  const encoded = JSON.stringify(value);
  if (encoded.length > MAX_CASE_TEXT * 4) throw new Error("A clerking section is too large.");
  return encoded;
};
export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context); if (isResponse(user)) return user;
  const result = await context.env.DB.prepare("SELECT id, case_reference, title, specialty, presenting_complaint, status, created_at, updated_at FROM cases WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100").bind(user.id).all();
  return json({ cases: result.results });
};
export const onRequestPost = async ({ request, env }: AppContext) => {
  if (!validSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser({ request, env, params: {} }); if (isResponse(user)) return user;
  let body: Record<string, unknown>; try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: "Invalid JSON body." }, 400); }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const complaint = typeof body.presentingComplaint === "string" ? body.presentingComplaint.trim() : "";
  const specialty = typeof body.specialty === "string" ? body.specialty : "general-medicine";
  const reference = typeof body.caseReference === "string" ? body.caseReference.trim() : "";
  if (!title || title.length > 120 || !complaint || complaint.length > MAX_CASE_TEXT || !allowedSpecialties.has(specialty)) return json({ error: "Enter a case title, a presenting complaint and a valid specialty." }, 400);
  if (!reference || reference.length > 80) return json({ error: "Use a non-identifying case reference (for example, CASE-001)." }, 400);
  let history: string, examination: string, assessment: string, plan: string;
  try { history=section(body.history); examination=section(body.examination); assessment=section(body.assessment); plan=section(body.plan); }
  catch(e) { return json({ error: e instanceof Error ? e.message : "Invalid clerking sections." }, 400); }
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO cases (id, user_id, case_reference, title, specialty, presenting_complaint, history_json, examination_json, assessment_json, plan_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))")
    .bind(id, user.id, reference, title, specialty, complaint, history, examination, assessment, plan).run();
  await writeAudit(env.DB, user.id, "case.created", id, request);
  return json({ case: { id, caseReference: reference, title, specialty, presentingComplaint: complaint, status: "draft" } }, 201);
};
