import { json, requireUser, isResponse, type AppContext } from "../../_lib/auth";

type SearchStudent = {
  id: string; name: string; university: string; level: string;
  lastSeenAt: number | null; profilePhotoUrl: string | null;
};
type Connection = {
  id: string; userLowId: string; userHighId: string;
  requestedBy: string; requestedTo: string; status: "pending" | "accepted";
};

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const url = new URL(context.request.url);
  const query = (url.searchParams.get("q") || "").trim().replace(/[%_]/g, "");
  if (query.length < 2) return json({ users: [] });
  if (query.length > 60) return json({ error: "Search is too long." }, 400);
  const pattern = "%" + query + "%";
  const result = await context.env.DB.prepare(`
    SELECT p.id, p.full_name AS name, p.school AS university, p.level,
      p.last_seen_at AS lastSeenAt,
      (SELECT '/api/profile/photo/' || p.id || '?v=' || photos.updated_at
        FROM clerkme_profile_photos_v1 photos WHERE photos.user_id = p.id) AS profilePhotoUrl
    FROM student_profiles p
    WHERE p.id <> ? AND p.email_verified_at IS NOT NULL
      AND (p.full_name LIKE ? COLLATE NOCASE OR p.school LIKE ? COLLATE NOCASE)
      AND NOT EXISTS (
        SELECT 1 FROM direct_message_blocks b
        WHERE (b.blocker_id = ? AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = ?)
      )
    ORDER BY p.full_name COLLATE NOCASE LIMIT 12
  `).bind(user.id, pattern, pattern, user.id, user.id).all<SearchStudent>();

  const connections = await context.env.DB.prepare(
    "SELECT id, user_low_id AS userLowId, user_high_id AS userHighId, " +
    "requested_by AS requestedBy, requested_to AS requestedTo, status " +
    "FROM clerkme_student_connections_v1 WHERE (user_low_id = ? OR user_high_id = ?) AND status IN ('pending', 'accepted')"
  ).bind(user.id, user.id).all<Connection>();
  const byStudent = new Map(connections.results.map(connection => [
    connection.userLowId === user.id ? connection.userHighId : connection.userLowId,
    connection
  ]));

  const users = result.results.map(student => {
    const connection = byStudent.get(student.id);
    const connectionStatus = !connection ? "none" :
      connection.status === "accepted" ? "accepted" :
      connection.requestedBy === user.id ? "pending_sent" : "pending_received";
    return { ...student, connectionStatus, connectionId: connection?.id || null };
  });
  return json({ users });
};
