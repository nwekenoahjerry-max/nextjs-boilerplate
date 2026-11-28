import type { D1Database } from "./auth";
import { hasAcceptedConnection } from "./connections";

export type StatusAudience = "everyone" | "conversations" | "only_me";
export type StatusPreferences = {
  default_audience: StatusAudience;
  hide_views: number;
  allow_replies: number;
};

export async function getStatusPreferences(db: D1Database, userId: string): Promise<StatusPreferences> {
  const row = await db.prepare(
    "SELECT default_audience, hide_views, allow_replies FROM status_preferences WHERE user_id = ? LIMIT 1"
  ).bind(userId).first<StatusPreferences>();
  return row || { default_audience: "everyone", hide_views: 0, allow_replies: 1 };
}

export async function canViewStatus(db: D1Database, viewerId: string, statusId: string): Promise<boolean> {
  const status = await db.prepare(
    "SELECT user_id, visibility FROM status_posts WHERE id = ? AND expires_at > unixepoch() LIMIT 1"
  ).bind(statusId).first<{ user_id: string; visibility: StatusAudience }>();
  if (!status) return false;
  if (status.user_id === viewerId) return true;

  const blocked = await db.prepare(
    "SELECT 1 AS blocked FROM direct_message_blocks WHERE " +
    "(blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1"
  ).bind(viewerId, status.user_id, status.user_id, viewerId).first();
  if (blocked || status.visibility === "only_me") return false;
  if (status.visibility === "everyone") return true;

  return hasAcceptedConnection(db, viewerId, status.user_id);
}