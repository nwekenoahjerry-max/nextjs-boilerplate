import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../_lib/auth";

type NotificationRow = {
  id: string; kind: string; title: string; message: string;
  destination: "materials" | "qbank" | "study" | "you";
  is_read: number; created_at: number;
};

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;

  // Convert completed and failed study jobs to durable, deduplicated updates.
  await context.env.DB.prepare(
    "INSERT OR IGNORE INTO student_notifications (id, user_id, dedupe_key, kind, title, message, destination, created_at) " +
    "SELECT lower(hex(randomblob(16))), jobs.user_id, 'study-guide:' || jobs.id || ':' || jobs.status, " +
    "CASE WHEN jobs.status = 'completed' THEN 'study_guide_ready' ELSE 'study_guide_failed' END, " +
    "CASE WHEN jobs.status = 'completed' THEN 'Your study guide is ready' ELSE 'Your study guide could not be completed' END, " +
    "CASE WHEN jobs.status = 'completed' THEN 'ClerkMe has finished preparing ' || materials.title || '.' " +
    "ELSE 'ClerkMe could not finish preparing ' || materials.title || '. Your uploaded material is still saved.' END, " +
    "'materials', jobs.updated_at FROM study_generation_jobs AS jobs " +
    "INNER JOIN learning_materials AS materials ON materials.id = jobs.material_id AND materials.user_id = jobs.user_id " +
    "WHERE jobs.user_id = ? AND jobs.status IN ('completed', 'failed') AND jobs.updated_at >= unixepoch() - 2592000"
  ).bind(user.id).run();

  const [rows, unread] = await Promise.all([
    context.env.DB.prepare(
      "SELECT id, kind, title, message, destination, is_read, created_at FROM student_notifications " +
      "WHERE user_id = ? ORDER BY created_at DESC LIMIT 30"
    ).bind(user.id).all<NotificationRow>(),
    context.env.DB.prepare(
      "SELECT COUNT(*) AS count FROM student_notifications WHERE user_id = ? AND is_read = 0"
    ).bind(user.id).first<{ count: number }>()
  ]);

  return json({
    notifications: rows.results.map(row => ({
      id: row.id, kind: row.kind, title: row.title, message: row.message,
      destination: row.destination, isRead: row.is_read === 1, createdAt: row.created_at
    })),
    unreadCount: Number(unread?.count) || 0
  });
};

export const onRequestPatch = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;

  let body: Record<string, unknown>;
  try {
    const value: unknown = await context.request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "Invalid notification update." }, 400);
    body = value as Record<string, unknown>;
  } catch { return json({ error: "Invalid notification update." }, 400); }

  if (body.readAll === true) {
    await context.env.DB.prepare(
      "UPDATE student_notifications SET is_read = 1, read_at = unixepoch() WHERE user_id = ? AND is_read = 0"
    ).bind(user.id).run();
    return json({ updated: true });
  }
  const id = typeof body.id === "string" ? body.id.trim().slice(0, 80) : "";
  if (!id) return json({ error: "Select a notification to mark as read." }, 400);
  await context.env.DB.prepare(
    "UPDATE student_notifications SET is_read = 1, read_at = unixepoch() WHERE id = ? AND user_id = ?"
  ).bind(id, user.id).run();
  return json({ updated: true });
};
