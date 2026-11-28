import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

export const onRequestPatch = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;

  const connectionId = (context.params.connectionId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(connectionId)) return json({ error: "Connection request not found." }, 404);

  let body: { action?: unknown };
  try { body = await context.request.json() as { action?: unknown }; }
  catch { return json({ error: "Choose an action for this connection request." }, 400); }
  const action = typeof body.action === "string" ? body.action : "";
  if (!["accept", "decline", "cancel"].includes(action)) return json({ error: "Unsupported connection action." }, 400);

  const connection = await context.env.DB.prepare(
    "SELECT id, requested_by AS requestedBy, requested_to AS requestedTo, status " +
    "FROM clerkme_student_connections_v1 WHERE id = ? AND (user_low_id = ? OR user_high_id = ?) LIMIT 1"
  ).bind(connectionId, user.id, user.id).first<{
    id: string; requestedBy: string; requestedTo: string; status: string;
  }>();
  if (!connection || connection.status !== "pending") return json({ error: "This connection request is no longer pending." }, 404);

  if (action === "accept" || action === "decline") {
    if (connection.requestedTo !== user.id) return json({ error: "Only the recipient can respond to this request." }, 403);
    if (action === "accept") {
      const blocked = await context.env.DB.prepare(
        "SELECT 1 AS blocked FROM direct_message_blocks WHERE " +
        "(blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1"
      ).bind(user.id, connection.requestedBy, connection.requestedBy, user.id).first();
      if (blocked) return json({ error: "This student is unavailable." }, 403);
    }
    const nextStatus = action === "accept" ? "accepted" : "declined";
    await context.env.DB.prepare(
      "UPDATE clerkme_student_connections_v1 SET status = ?, updated_at = unixepoch(), responded_at = unixepoch() " +
      "WHERE id = ? AND requested_to = ? AND status = 'pending'"
    ).bind(nextStatus, connectionId, user.id).run();
    return json({ updated: true, status: nextStatus });
  }

  if (connection.requestedBy !== user.id) return json({ error: "Only the sender can cancel this request." }, 403);
  await context.env.DB.prepare(
    "UPDATE clerkme_student_connections_v1 SET status = 'removed', updated_at = unixepoch(), responded_at = unixepoch() " +
    "WHERE id = ? AND requested_by = ? AND status = 'pending'"
  ).bind(connectionId, user.id).run();
  return json({ updated: true, status: "removed" });
};

export const onRequestDelete = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;

  const connectionId = (context.params.connectionId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(connectionId)) return json({ error: "Connection not found." }, 404);
  const connection = await context.env.DB.prepare(
    "SELECT id, user_low_id AS userLowId, user_high_id AS userHighId, status " +
    "FROM clerkme_student_connections_v1 WHERE id = ? AND (user_low_id = ? OR user_high_id = ?) LIMIT 1"
  ).bind(connectionId, user.id, user.id).first<{
    id: string; userLowId: string; userHighId: string; status: string;
  }>();
  if (!connection || connection.status !== "accepted") return json({ error: "This connection is no longer active." }, 404);

  await context.env.DB.prepare(
    "UPDATE clerkme_student_connections_v1 SET status = 'removed', updated_at = unixepoch(), responded_at = unixepoch() " +
    "WHERE id = ? AND status = 'accepted'"
  ).bind(connectionId).run();
  await context.env.DB.prepare(
    "UPDATE direct_conversation_members SET archived_at = unixepoch() " +
    "WHERE user_id IN (?, ?) AND conversation_id IN " +
    "(SELECT id FROM direct_conversations WHERE pair_key = ?)"
  ).bind(connection.userLowId, connection.userHighId, connection.userLowId + ":" + connection.userHighId).run();

  return json({ removed: true });
};
