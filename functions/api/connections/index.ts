import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";
import { notifyStudent } from "../../_lib/notifications";

type ConnectionRow = {
  connectionId: string;
  status: "pending" | "accepted";
  requestedBy: string;
  createdAt: number;
  updatedAt: number;
  otherId: string;
  name: string;
  university: string;
  level: string;
  lastSeenAt: number | null;
  profilePhotoUrl: string | null;
};

const photoUrl = "(SELECT '/api/profile/photo/' || p.id || '?v=' || photos.updated_at " +
  "FROM clerkme_profile_photos_v1 photos WHERE photos.user_id = p.id)";

const connectionSelect = `
  SELECT c.id AS connectionId, c.status, c.requested_by AS requestedBy,
    c.created_at AS createdAt, c.updated_at AS updatedAt,
    p.id AS otherId, p.full_name AS name, p.school AS university,
    p.level, p.last_seen_at AS lastSeenAt, ${photoUrl} AS profilePhotoUrl
  FROM clerkme_student_connections_v1 c
  INNER JOIN student_profiles p
    ON p.id = CASE WHEN c.requested_by = ? THEN c.requested_to ELSE c.requested_by END
  WHERE NOT EXISTS (
    SELECT 1 FROM direct_message_blocks b
    WHERE (b.blocker_id = ? AND b.blocked_id = p.id)
       OR (b.blocker_id = p.id AND b.blocked_id = ?)
  )
`;

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;

  const [incoming, outgoing, accepted] = await Promise.all([
    context.env.DB.prepare(connectionSelect + " AND c.status = 'pending' AND c.requested_to = ? ORDER BY c.created_at DESC LIMIT 50")
      .bind(user.id, user.id, user.id, user.id).all<ConnectionRow>(),
    context.env.DB.prepare(connectionSelect + " AND c.status = 'pending' AND c.requested_by = ? ORDER BY c.created_at DESC LIMIT 50")
      .bind(user.id, user.id, user.id, user.id).all<ConnectionRow>(),
    context.env.DB.prepare(connectionSelect + " AND c.status = 'accepted' AND (c.user_low_id = ? OR c.user_high_id = ?) ORDER BY p.full_name COLLATE NOCASE LIMIT 200")
      .bind(user.id, user.id, user.id, user.id, user.id).all<ConnectionRow>()
  ]);

  return json({
    incoming: incoming.results,
    outgoing: outgoing.results,
    accepted: accepted.results
  });
};

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;

  let body: { recipientId?: unknown };
  try { body = await context.request.json() as { recipientId?: unknown }; }
  catch { return json({ error: "Choose a student to connect with." }, 400); }
  const recipientId = typeof body.recipientId === "string" ? body.recipientId.trim() : "";
  if (!recipientId || recipientId.length > 100 || recipientId === user.id) {
    return json({ error: "Choose a valid student." }, 400);
  }

  const recipient = await context.env.DB.prepare(
    "SELECT id FROM student_profiles WHERE id = ? AND email_verified_at IS NOT NULL"
  ).bind(recipientId).first<{ id: string }>();
  if (!recipient) return json({ error: "That verified student account could not be found." }, 404);

  const blocked = await context.env.DB.prepare(
    "SELECT 1 AS blocked FROM direct_message_blocks WHERE " +
    "(blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?) LIMIT 1"
  ).bind(user.id, recipientId, recipientId, user.id).first();
  if (blocked) return json({ error: "This student is unavailable." }, 403);

  const [userLow, userHigh] = [user.id, recipientId].sort();
  const existing = await context.env.DB.prepare(
    "SELECT id, requested_by AS requestedBy, requested_to AS requestedTo, status, updated_at AS updatedAt " +
    "FROM clerkme_student_connections_v1 WHERE user_low_id = ? AND user_high_id = ? LIMIT 1"
  ).bind(userLow, userHigh).first<{
    id: string; requestedBy: string; requestedTo: string;
    status: "pending" | "accepted" | "declined" | "removed"; updatedAt: number;
  }>();

  if (existing?.status === "accepted") return json({ connectionId: existing.id, status: "accepted", alreadyConnected: true });
  if (existing?.status === "pending") {
    if (existing.requestedBy === recipientId && existing.requestedTo === user.id) {
      await context.env.DB.prepare(
        "UPDATE clerkme_student_connections_v1 SET status = 'accepted', updated_at = unixepoch(), responded_at = unixepoch() " +
        "WHERE id = ? AND status = 'pending' AND requested_to = ?"
      ).bind(existing.id, user.id).run();
      await notifyStudent(context, { userId: existing.requestedBy, dedupeKey: "connection-accepted:"+existing.id+":"+existing.requestedBy,
        kind:"connection_accepted",title:"Connection accepted",message:"Your connection request was accepted. You can now message each other.",
        url:"/?open=messages",tag:"clerkme-connection-accepted-"+existing.id });
      return json({ connectionId: existing.id, status: "accepted", mutualRequest: true });
    }
    return json({
      connectionId: existing.id,
      status: existing.requestedBy === user.id ? "pending_sent" : "pending_received",
      alreadyRequested: true
    }, 200);
  }

  if (existing?.status === "declined" && existing.requestedBy === user.id &&
      existing.updatedAt > Math.floor(Date.now() / 1000) - 7 * 86400) {
    return json({ error: "This student has declined the request. You can try again after seven days." }, 429);
  }

  const recent = await context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM clerkme_student_connections_v1 WHERE requested_by = ? AND status = 'pending' AND created_at >= unixepoch() - 86400"
  ).bind(user.id).first<{ count: number }>();
  if (Number(recent?.count || 0) >= 25) {
    return json({ error: "You have reached today's connection-request limit. Try again tomorrow." }, 429);
  }

  if (existing) {
    const canReopen = existing.status === "removed" ||
      (existing.status === "declined" && existing.requestedTo === user.id);
    if (!canReopen) return json({ error: "This connection request cannot be sent again yet." }, 409);
    await context.env.DB.prepare(
      "UPDATE clerkme_student_connections_v1 SET requested_by = ?, requested_to = ?, status = 'pending', " +
      "created_at = unixepoch(), updated_at = unixepoch(), responded_at = NULL WHERE id = ?"
    ).bind(user.id, recipientId, existing.id).run();
    await notifyStudent(context, {userId:recipientId,dedupeKey:"connection-request:"+existing.id,kind:"connection_request",
      title:"New connection request",message:"A verified ClerkMe student would like to connect with you.",
      url:"/?open=connections",tag:"clerkme-connection-request-"+existing.id});
    return json({ connectionId: existing.id, status: "pending_sent" }, 201);
  }

  const connectionId = crypto.randomUUID();
  await context.env.DB.prepare(
    "INSERT OR IGNORE INTO clerkme_student_connections_v1 " +
    "(id, user_low_id, user_high_id, requested_by, requested_to, status, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, 'pending', unixepoch(), unixepoch())"
  ).bind(connectionId, userLow, userHigh, user.id, recipientId).run();

  const saved = await context.env.DB.prepare(
    "SELECT id, requested_by AS requestedBy, status FROM clerkme_student_connections_v1 WHERE user_low_id = ? AND user_high_id = ? LIMIT 1"
  ).bind(userLow, userHigh).first<{ id: string; requestedBy: string; status: string }>();
  if (!saved) return json({ error: "The connection request could not be saved." }, 500);
  if (saved.status === "pending" && saved.requestedBy === user.id) {
    await notifyStudent(context, {userId:recipientId,dedupeKey:"connection-request:"+saved.id,kind:"connection_request",
      title:"New connection request",message:"A verified ClerkMe student would like to connect with you.",
      url:"/?open=connections",tag:"clerkme-connection-request-"+saved.id});
  }
  return json({
    connectionId: saved.id,
    status: saved.status === "accepted" ? "accepted" : saved.requestedBy === user.id ? "pending_sent" : "pending_received"
  }, 201);
};
