import { json, requireUser, isResponse, validSameOrigin, writeAudit, type AppContext, MAX_CASE_TEXT } from "../../_lib/auth";
const fields = new Set(["title", "presentingComplaint", "history", "examination", "assessment", "plan", "status"]);
const jsonFields = new Set(["history", "examination", "assessment", "plan"]);
export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context); if (isResponse(user)) return user;
  const row = await context.env.DB.prepare("SELECT id, case_reference, title, specialty, presenting_complaint, history_json, examination_json, assessment_json, plan_json, status, created_at, updated_at FROM cases WHERE id = ? AND user_id = ? AND deleted_at IS NULL").bind(context.params.id, user.id).first<Record<string, unknown>>();
  if (!row) return json({ error: "Case not found." }, 404);
  return json({ case: { id: row.id, caseReference: row.case_reference, title: row.title, specialty: row.specialty, presentingComplaint: row.presenting_complaint, history: JSON.parse(String(row.history_json)), examination: JSON.parse(String(row.examination_json)), assessment: JSON.parse(String(row.assessment_json)), plan: JSON.parse(String(row.plan_json)), status: row.status, createdAt: row.created_at, updatedAt: row.updated_at } });
};
export const onRequestPatch = async ({ request, env, params }: AppContext) => {
  if (!validSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser({ request, env, params }); if (isResponse(user)) return user;
  let body: Record<string, unknown>; try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: "Invalid JSON body." }, 400); }
  const updates: string[] = []; const values: unknown[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (!fields.has(key)) continue;
    if (key === "title" || key === "presentingComplaint") {
      if (typeof value !== "string" || !value.trim() || value.length > MAX_CASE_TEXT) return json({ error: "Invalid text field: " + key }, 400);
      updates.push(key === "title" ? "title = ?" : "presenting_complaint = ?"); values.push(value.trim());
    } else if (jsonFields.has(key)) {
      if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(value).length > MAX_CASE_TEXT * 4) return json({ error: "Invalid structured section: " + key }, 400);
      const column = ({ history: "history_json", examination: "examination_json", assessment: "assessment_json", plan: "plan_json" } as Record<string,string>)[key];
      updates.push(column + " = ?"); values.push(JSON.stringify(value));
    } else if (key === "status") {
      if (!["draft", "in-progress", "completed"].includes(String(value))) return json({ error: "Invalid case status." }, 400);
      updates.push("status = ?"); values.push(value);
    }
  }
  if (!updates.length) return json({ error: "No valid case fields supplied." }, 400);
  updates.push("updated_at = datetime('now')"); values.push(params.id, user.id);
  const result = await env.DB.prepare("UPDATE cases SET " + updates.join(", ") + " WHERE id = ? AND user_id = ? AND deleted_at IS NULL").bind(...values).run();
  if ((result as { meta?: { changes?: number } }).meta?.changes === 0) return json({ error: "Case not found." }, 404);
  await writeAudit(env.DB, user.id, "case.updated", params.id, request);
  return json({ ok: true });
};
export const onRequestDelete = async ({ request, env, params }: AppContext) => {
  if (!validSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser({ request, env, params }); if (isResponse(user)) return user;
  const result = await env.DB.prepare("UPDATE cases SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND user_id = ? AND deleted_at IS NULL").bind(params.id, user.id).run();
  if ((result as { meta?: { changes?: number } }).meta?.changes === 0) return json({ error: "Case not found." }, 404);
  await writeAudit(env.DB, user.id, "case.deleted", params.id, request);
  return json({ ok: true });
};
