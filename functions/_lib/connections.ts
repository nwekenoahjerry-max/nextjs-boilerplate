import type { D1Database } from "./auth";

export async function hasAcceptedConnection(db: D1Database, firstUserId: string, secondUserId: string): Promise<boolean> {
  if (!firstUserId || !secondUserId || firstUserId === secondUserId) return false;
  const [userLowId, userHighId] = [firstUserId, secondUserId].sort();
  const row = await db.prepare(
    "SELECT 1 AS connected FROM student_connections " +
    "WHERE user_low_id = ? AND user_high_id = ? AND status = 'accepted' LIMIT 1"
  ).bind(userLowId, userHighId).first();
  return Boolean(row);
}
