import { json, requireAdmin, isResponse, validSameOrigin, type AppContext } from "../../../_lib/auth";

const states = new Set(["open", "reviewing", "closed"]);
type ReportRow = {
  id: string; messageId: number; conversationId: string; reason: string; details: string;
  status: "open" | "reviewing" | "closed"; createdAt: number; messageBody: string;
  reporterName: string; reporterEmail: string; reportedName: string; reportedEmail: string;
};

export const onRequestGet = async (context: AppContext) => {
  const admin = await requireAdmin(context);
  if (isResponse(admin)) return admin;
  const params = new URL(context.request.url).searchParams;
  const status = params.get("status") || "open";
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.get("page") || "1", 10) || 1));
  const perPage = Math.max(10, Math.min(50, Number.parseInt(params.get("perPage") || "20", 10) || 20));
  const offset = (page - 1) * perPage;
  const where = status === "all" ? "" : "WHERE r.status = ?";
  const values = status === "all" ? [] : [status];
  if (status !== "all" && !states.has(status)) return json({ error: "Choose a valid report status." }, 400);
  try {
    const [count, rows] = await Promise.all([
      context.env.DB.prepare("SELECT COUNT(*) AS total FROM direct_message_reports r " + where)
        .bind(...values).first<{ total: number }>(),
      context.env.DB.prepare(`
        SELECT r.id, r.message_id AS messageId, r.conversation_id AS conversationId,
          r.reason, r.details, r.status, r.created_at AS createdAt,
          m.body AS messageBody,
          reporter.full_name AS reporterName, reporter.email AS reporterEmail,
          reported.full_name AS reportedName, reported.email AS reportedEmail
        FROM direct_message_reports r
        INNER JOIN direct_messages m ON m.id = r.message_id
        INNER JOIN student_profiles reporter ON reporter.id = r.reporter_id
        INNER JOIN student_profiles reported ON reported.id = r.reported_user_id
        ${where}
        ORDER BY r.created_at DESC LIMIT ? OFFSET ?
      `).bind(...values, perPage, offset).all<ReportRow>()
    ]);
    const total = Number(count?.total) || 0;
    return json({
      reports: rows.results,
      page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage))
    });
  } catch (error) {
    console.error("[ClerkME admin] Message report query failed.", error instanceof Error ? error.message : "Unknown database error.");
    return json({ error: "The message reports could not be loaded. Please try again." }, 500);
  }
};

export const onRequestPatch = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const admin = await requireAdmin(context);
  if (isResponse(admin)) return admin;
  let body: { id?: unknown; status?: unknown };
  try { body = await context.request.json() as typeof body; }
  catch { return json({ error: "Choose a report and a valid status." }, 400); }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? body.status : "";
  if (!id || id.length > 80 || !states.has(status)) return json({ error: "Choose a report and a valid status." }, 400);
  const result = await context.env.DB.prepare(
    "UPDATE direct_message_reports SET status = ? WHERE id = ?"
  ).bind(status, id).run();
  const changes = Number((result as { meta?: { changes?: number } }).meta?.changes || 0);
  if (changes < 1) return json({ error: "Report not found." }, 404);
  return json({ updated: true, id, status });
};
