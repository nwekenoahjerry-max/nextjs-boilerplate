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
    SELECT p.id, p.full_name AS name, p.school AS university, p.level, p.last_seen_at AS lastSeenAt,
      CASE WHEN sc.user_a_id IS NOT NULL THEN 'connected'
        WHEN incoming.id IS NOT NULL THEN 'incoming'
        WHEN outgoing.id IS NOT NULL THEN 'outgoing'
        ELSE 'none' END AS relationship,
      COALESCE(incoming.id,outgoing.id) AS requestId,
      CASE WHEN p.profile_photo_key IS NOT NULL AND sc.user_a_id IS NOT NULL
        THEN '/api/profile/photo?userId=' || p.id ELSE NULL END AS photoUrl
    FROM student_profiles p
    LEFT JOIN student_connections sc
      ON sc.user_a_id=CASE WHEN p.id < ? THEN p.id ELSE ? END
      AND sc.user_b_id=CASE WHEN p.id < ? THEN ? ELSE p.id END
    LEFT JOIN student_connection_requests incoming
      ON incoming.sender_id=p.id AND incoming.recipient_id=? AND incoming.status='pending'
    LEFT JOIN student_connection_requests outgoing
      ON outgoing.sender_id=? AND outgoing.recipient_id=p.id AND outgoing.status='pending'
    WHERE p.id <> ? AND p.email_verified_at IS NOT NULL
      AND (p.full_name LIKE ? COLLATE NOCASE OR p.school LIKE ? COLLATE NOCASE)
      AND NOT EXISTS (
        SELECT 1 FROM direct_message_blocks b
        WHERE (b.blocker_id = ? AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = ?)
      )
    ORDER BY p.full_name COLLATE NOCASE LIMIT 12
  `).bind(user.id,user.id,user.id,user.id,user.id,user.id,user.id,pattern,pattern,user.id,user.id).all<{
    id: string; name: string; university: string; level: string; lastSeenAt: number | null;
    relationship: "connected"|"incoming"|"outgoing"|"none"; requestId: string|null; photoUrl: string|null;
  }>();
  return json({ users: result.results });
};
