import { json, requireUser, isResponse, type AppContext } from "../../_lib/auth";

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const url = new URL(context.request.url);
  const query = (url.searchParams.get("q") || "").trim().replace(/[%_]/g, "");
  if (query.length < 2) return json({ users: [] });
  if (query.length > 60) return json({ error: "Search is too long." }, 400);
  const pattern = "%" + query + "%";
  const result = await context.env.DB.prepare(`
    SELECT p.id, p.full_name AS name, p.school AS university, p.level, p.last_seen_at AS lastSeenAt
    FROM student_profiles p
    WHERE p.id <> ? AND p.email_verified_at IS NOT NULL
      AND (p.full_name LIKE ? COLLATE NOCASE OR p.school LIKE ? COLLATE NOCASE)
      AND NOT EXISTS (
        SELECT 1 FROM direct_message_blocks b
        WHERE (b.blocker_id = ? AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = ?)
      )
    ORDER BY p.full_name COLLATE NOCASE LIMIT 12
  `).bind(user.id, pattern, pattern, user.id, user.id).all<{
    id: string; name: string; university: string; level: string; lastSeenAt: number | null;
  }>();
  return json({ users: result.results });
};
