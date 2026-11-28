const SESSION_COOKIE = "__Host-clerkme_session";
const MAX_MESSAGE_LENGTH = 4000;

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function readSessionCookie(request) {
  const cookie = request.headers.get("Cookie") || "";
  const value = cookie.split(";").map(part => part.trim())
    .find(part => part.startsWith(SESSION_COOKIE + "="))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return null; }
}

function safeSend(socket, payload) {
  try {
    if (socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  } catch { return false; }
}

export class ConversationRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const internalUrl = new URL(request.url);
    if (request.method === "POST" && internalUrl.pathname === "/internal/push-test") {
      let input;
      try { input = await request.json(); } catch { return Response.json({ error: "Invalid test request." }, { status: 400 }); }
      const userId = typeof input?.userId === "string" ? input.userId.slice(0, 100) : "";
      if (!userId || !this.env.PUSH_SERVICE || !this.env.PUSH_INTERNAL_TOKEN) {
        return Response.json({ error: "Phone notifications are not available right now." }, { status: 503 });
      }
      const subscriptions = await this.env.DB.prepare(
        "SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id = ?"
      ).bind(userId).first();
      if (!Number(subscriptions?.count)) return Response.json({ error: "This device is not registered. Enable phone notifications first." }, { status: 409 });
      try {
        const response = await this.env.PUSH_SERVICE.fetch("https://clerkme-reminders.internal/internal/direct-message", {
          method: "POST",
          headers: { "Authorization": "Bearer " + this.env.PUSH_INTERNAL_TOKEN, "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            title: "ClerkMe notifications are working",
            body: "You will now receive alerts when a student sends you a private message.",
            url: "/?open=messages",
            tag: "clerkme-test-" + crypto.randomUUID()
          })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !Number(result.sent)) {
          return Response.json({ error: result.error || "The test alert could not be delivered. Check your device notification permission." }, response.ok ? 502 : response.status);
        }
        return Response.json({ sent: Number(result.sent) });
      } catch (error) {
        console.error("[clerkme-chat] Test push failed.", error instanceof Error ? error.message : "unknown error");
        return Response.json({ error: "The notification service could not be reached." }, { status: 502 });
      }
    }
    if (request.method === "POST" && internalUrl.pathname === "/internal/message-edit") {
      let input;
      try { input = await request.json(); } catch { return Response.json({ error: "Invalid edit event." }, { status: 400 }); }
      const conversationId = typeof input?.conversationId === "string" ? input.conversationId.slice(0, 80) : "";
      const messageId = Number(input?.messageId);
      if (!conversationId || !Number.isSafeInteger(messageId) || messageId < 1) return Response.json({ error: "Invalid edit event." }, { status: 400 });
      const message = await this.env.DB.prepare(
        "SELECT m.id, m.public_id, m.conversation_id, m.sender_id, m.client_message_id, m.body, m.created_at, m.delivered_at, m.edited_at, sr.status_id AS reply_to_status_id " +
        "FROM direct_messages m LEFT JOIN status_replies sr ON sr.message_id = m.id " +
        "WHERE m.id = ? AND m.conversation_id = ? AND m.deleted_at IS NULL LIMIT 1"
      ).bind(messageId, conversationId).first();
      if (!message) return Response.json({ error: "Message not found." }, { status: 404 });
      this.broadcast(conversationId, { type: "message:updated", message });
      return Response.json({ updated: true });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const origin = request.headers.get("Origin");
    if (!origin) return new Response("Origin is required", { status: 403 });
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return new Response("Invalid origin", { status: 403 });
      }
    } catch { return new Response("Invalid origin", { status: 403 }); }

    const requestUrl = new URL(request.url);
    let conversationId = requestUrl.searchParams.get("conversationId") || requestUrl.pathname.split("/")[3] || "";
    try { conversationId = decodeURIComponent(conversationId); }
    catch { return new Response("Conversation not found", { status: 404 }); }
    if (!conversationId || conversationId.length > 80) {
      return new Response("Conversation not found", { status: 404 });
    }

    const token = readSessionCookie(request);
    if (!token) return new Response("Authentication required", { status: 401 });
    const tokenHash = await sha256(token);
    const session = await this.env.DB.prepare(`
      SELECT s.user_id AS userId
      FROM sessions s
      INNER JOIN student_profiles p ON p.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > unixepoch()
        AND p.email_verified_at IS NOT NULL
      LIMIT 1
    `).bind(tokenHash).first();
    if (!session) return new Response("Session expired", { status: 401 });

    const membership = await this.env.DB.prepare(`
      SELECT other.user_id AS otherId
      FROM direct_conversation_members me
      INNER JOIN direct_conversation_members other
        ON other.conversation_id = me.conversation_id AND other.user_id <> me.user_id
      WHERE me.conversation_id = ? AND me.user_id = ? AND me.archived_at IS NULL
      LIMIT 1
    `).bind(conversationId, session.userId).first();
    if (!membership || !await this.isConnected(session.userId, membership.otherId)) {
      return new Response("An accepted connection is required", { status: 403 });
    }

    if (await this.isBlocked(session.userId, membership.otherId)) {
      return new Response("Conversation unavailable", { status: 403 });
    }

    await this.env.DB.prepare(
      "UPDATE student_profiles SET last_seen_at = unixepoch() WHERE id = ?"
    ).bind(session.userId).run();

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    server.serializeAttachment({
      userId: session.userId,
      tokenHash,
      conversationId
    });

    this.broadcast(conversationId, {
      type: "presence:update",
      userId: session.userId,
      isOnline: true,
      at: Math.floor(Date.now() / 1000)
    }, session.userId);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, raw) {
    let identity;
    try { identity = socket.deserializeAttachment(); }
    catch { socket.close(1008, "Invalid connection"); return; }

    if (!await this.isSessionActive(identity)) {
      socket.close(1008, "Session expired");
      return;
    }
    const peer = await this.env.DB.prepare(
      "SELECT user_id AS id FROM direct_conversation_members WHERE conversation_id = ? AND user_id <> ? LIMIT 1"
    ).bind(identity.conversationId, identity.userId).first();
    if (!peer || await this.isBlocked(identity.userId, peer.id) ||
        !await this.isConnected(identity.userId, peer.id)) {
      socket.close(1008, "Conversation unavailable");
      return;
    }

    const rawText = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    if (rawText.length > MAX_MESSAGE_LENGTH + 2000) {
      safeSend(socket, { type: "error", code: "PAYLOAD_TOO_LARGE", message: "This message is too large." });
      return;
    }

    let payload;
    try { payload = JSON.parse(rawText); }
    catch {
      safeSend(socket, { type: "error", code: "INVALID_PAYLOAD", message: "The message could not be read." });
      return;
    }

    if (payload.type === "ping") {
      await this.env.DB.prepare(
        "UPDATE student_profiles SET last_seen_at = unixepoch() WHERE id = ?"
      ).bind(identity.userId).run();
      safeSend(socket, { type: "pong", at: Math.floor(Date.now() / 1000) });
      return;
    }
    if (typeof payload.type === "string" && payload.type.startsWith("call:")) {
      const type = payload.type;
      const supported = new Set(["call:offer","call:answer","call:ice","call:decline","call:hangup","call:busy"]);
      if (!supported.has(type)) {
        safeSend(socket,{type:"error",message:"Unsupported call action."});
        return;
      }
      if (type === "call:offer" || type === "call:answer") {
        const signal = payload.signal;
        const expectedType = type === "call:offer" ? "offer" : "answer";
        if (!signal || signal.type !== expectedType || typeof signal.sdp !== "string" || signal.sdp.length > 12000) {
          safeSend(socket,{type:"error",message:"The call could not be started. Please try again."});
          return;
        }
      } else if (type === "call:ice") {
        const candidate = payload.signal;
        if (!candidate || typeof candidate.candidate !== "string" || candidate.candidate.length > 3000) {
          safeSend(socket,{type:"error",message:"The call connection details were invalid."});
          return;
        }
      }
      const delivered = this.sendToUser(identity.conversationId,peer.id,{
        type,userId:identity.userId,
        ...(payload.signal ? {signal:payload.signal} : {})
      });
      if (type === "call:offer") {
        safeSend(socket,{type:delivered ? "call:ringing" : "call:unavailable"});
      } else if (type !== "call:hangup" && !delivered) {
        safeSend(socket,{type:"call:unavailable"});
      }
      return;
    }
    if (payload.type === "typing") {
      this.broadcast(identity.conversationId, {
        type: "typing", userId: identity.userId, isTyping: payload.body === true
      }, identity.userId);
      return;
    }
    if (payload.type === "read") {
      await this.handleRead(identity, Number(payload.messageId));
      return;
    }
    if (payload.type === "message") {
      await this.handleNewMessage(identity, payload, socket);
      return;
    }
    safeSend(socket, { type: "error", code: "UNKNOWN_EVENT", message: "Unsupported messaging event." });
  }

  async webSocketClose(socket, code, reason) {
    let identity;
    try { identity = socket.deserializeAttachment(); } catch { identity = null; }
    if (identity) {
      const remaining = this.state.getWebSockets().some(candidate => {
        try {
          return candidate !== socket &&
            candidate.deserializeAttachment().userId === identity.userId &&
            candidate.readyState === WebSocket.OPEN;
        } catch { return false; }
      });
      if (!remaining) {
        this.broadcast(identity.conversationId, {
          type: "presence:update", userId: identity.userId,
          isOnline: false, at: Math.floor(Date.now() / 1000)
        }, identity.userId);
      }
    }

    // Complete the RFC 6455 close handshake for hibernatable WebSockets.
    const reservedCodes = [1004, 1005, 1006, 1015];
    if (Number.isInteger(code) && code >= 1000 && code < 5000 && !reservedCodes.includes(code)) {
      try { socket.close(code, typeof reason === "string" ? reason : ""); } catch { /* already closed */ }
    } else {
      try { socket.close(); } catch { /* already closed */ }
    }
  }

  async webSocketError(socket) {
    try { socket.close(1011, "Connection error"); } catch { /* already closed */ }
  }

  async isSessionActive(identity) {
    const session = await this.env.DB.prepare(
      "SELECT 1 AS ok FROM sessions WHERE token_hash = ? AND user_id = ? AND expires_at > unixepoch()"
    ).bind(identity.tokenHash, identity.userId).first();
    if (!session) return false;
    const peer = await this.env.DB.prepare(
      "SELECT other.user_id AS otherId FROM direct_conversation_members me " +
      "INNER JOIN direct_conversation_members other ON other.conversation_id = me.conversation_id AND other.user_id <> me.user_id " +
      "WHERE me.conversation_id = ? AND me.user_id = ? AND me.archived_at IS NULL LIMIT 1"
    ).bind(identity.conversationId, identity.userId).first();
    return Boolean(peer && await this.isConnected(identity.userId, peer.otherId));
  }

  async isConnected(userId, otherId) {
    if (!userId || !otherId || userId === otherId) return false;
    const [low, high] = [userId, otherId].sort();
    const row = await this.env.DB.prepare(
      "SELECT 1 AS connected FROM student_connection_requests WHERE user_low_id = ? AND user_high_id = ? AND status = 'accepted' LIMIT 1"
    ).bind(low, high).first();
    return Boolean(row);
  }

  async isBlocked(userId, otherId) {
    const row = await this.env.DB.prepare(`
      SELECT 1 AS blocked FROM direct_message_blocks
      WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
      LIMIT 1
    `).bind(userId, otherId, otherId, userId).first();
    return Boolean(row);
  }

  async checkRateLimit(userId) {
    const bucketHash = await sha256("direct-message:" + userId);
    await this.env.DB.prepare(`
      INSERT INTO auth_rate_limits (bucket_hash, hits, window_started_at)
      VALUES (?, 1, unixepoch())
      ON CONFLICT(bucket_hash) DO UPDATE SET
        hits = CASE WHEN auth_rate_limits.window_started_at <= unixepoch() - 60
          THEN 1 ELSE auth_rate_limits.hits + 1 END,
        window_started_at = CASE WHEN auth_rate_limits.window_started_at <= unixepoch() - 60
          THEN unixepoch() ELSE auth_rate_limits.window_started_at END
    `).bind(bucketHash).run();
    const row = await this.env.DB.prepare(
      "SELECT hits FROM auth_rate_limits WHERE bucket_hash = ?"
    ).bind(bucketHash).first();
    return Number(row?.hits || 0) <= 30;
  }

  broadcast(conversationId, payload, exceptUserId) {
    for (const candidate of this.state.getWebSockets()) {
      try {
        const identity = candidate.deserializeAttachment();
        if (identity.conversationId !== conversationId || identity.userId === exceptUserId) continue;
        safeSend(candidate, payload);
      } catch { /* Ignore stale attachments. */ }
    }
  }

  sendToUser(conversationId, userId, payload) {
    let delivered = false;
    for (const candidate of this.state.getWebSockets()) {
      try {
        const identity = candidate.deserializeAttachment();
        if (identity.conversationId !== conversationId || identity.userId !== userId) continue;
        delivered = safeSend(candidate, payload) || delivered;
      } catch { /* Ignore stale attachments. */ }
    }
    return delivered;
  }

  async handleNewMessage(identity, payload, socket) {
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    const clientMessageId = typeof payload.clientMessageId === "string" ? payload.clientMessageId : "";
    if (!body || body.length > MAX_MESSAGE_LENGTH || !/^[0-9a-f-]{36}$/i.test(clientMessageId)) {
      safeSend(socket, {
        type: "error", code: "INVALID_MESSAGE", clientMessageId,
        message: "Messages must contain between 1 and 4,000 characters."
      });
      return;
    }
    if (!await this.checkRateLimit(identity.userId)) {
      safeSend(socket, {
        type: "error", code: "RATE_LIMITED", clientMessageId,
        message: "You're sending messages too quickly. Please try again shortly."
      });
      return;
    }

    const other = await this.env.DB.prepare(
      "SELECT user_id AS id FROM direct_conversation_members WHERE conversation_id = ? AND user_id <> ? LIMIT 1"
    ).bind(identity.conversationId, identity.userId).first();
    if (!other || await this.isBlocked(identity.userId, other.id) ||
        !await this.isConnected(identity.userId, other.id)) {
      safeSend(socket, { type: "error", code: "CONVERSATION_UNAVAILABLE", message: "This conversation is unavailable. An accepted connection is required to send messages." });
      return;
    }

    const replyToStatusId = typeof payload.replyToStatusId === "string" &&
      payload.replyToStatusId.length <= 80 ? payload.replyToStatusId : "";
    if (replyToStatusId) {
      const status = await this.env.DB.prepare(
        "SELECT s.user_id AS ownerId, s.visibility, s.expires_at AS expiresAt, " +
        "COALESCE(p.allow_replies,1) AS allowReplies FROM status_posts s " +
        "LEFT JOIN status_preferences p ON p.user_id = s.user_id WHERE s.id = ? LIMIT 1"
      ).bind(replyToStatusId).first();
      const allowed = status && status.ownerId === other.id &&
        Number(status.expiresAt) > Math.floor(Date.now()/1000) &&
        status.visibility !== "only_me" && Number(status.allowReplies) === 1;
      if (!allowed) {
        safeSend(socket,{type:"error",code:"STATUS_REPLY_UNAVAILABLE",clientMessageId,
          message:"This status is no longer available for replies."});
        return;
      }
    }

    let message = await this.env.DB.prepare(`
      SELECT id, public_id, conversation_id, sender_id, client_message_id, body, created_at, delivered_at
      FROM direct_messages WHERE sender_id = ? AND client_message_id = ? LIMIT 1
    `).bind(identity.userId, clientMessageId).first();

    if (!message) {
      const publicId = crypto.randomUUID();
      await this.env.DB.prepare(`
        INSERT OR IGNORE INTO direct_messages
          (public_id, conversation_id, sender_id, client_message_id, body, created_at)
        VALUES (?, ?, ?, ?, ?, unixepoch())
      `).bind(publicId, identity.conversationId, identity.userId, clientMessageId, body).run();
      message = await this.env.DB.prepare(`
        SELECT id, public_id, conversation_id, sender_id, client_message_id, body, created_at, delivered_at
        FROM direct_messages WHERE sender_id = ? AND client_message_id = ? LIMIT 1
      `).bind(identity.userId, clientMessageId).first();
    }

    if (!message || message.conversation_id !== identity.conversationId) {
      safeSend(socket, {
        type: "error", code: "MESSAGE_NOT_SAVED", clientMessageId,
        message: "Your message could not be saved. Please try again."
      });
      return;
    }

    const messageId = Number(message.id);
    const createdAt = Number(message.created_at);
    if (replyToStatusId) {
      await this.env.DB.prepare(
        "INSERT OR IGNORE INTO status_replies (id,status_id,message_id,sender_id,created_at) VALUES (?,?,?,?,unixepoch())"
      ).bind(crypto.randomUUID(),replyToStatusId,messageId,identity.userId).run();
    }
    const isVoiceNote = body.startsWith("[[CLERKME_VOICE_NOTE_V1|");
    const preview = isVoiceNote ? "🎙 Voice note" : body.length > 160 ? body.slice(0, 157) + "…" : body;
    await this.env.DB.prepare(`
      UPDATE direct_conversations
      SET last_message_id = ?, last_message_preview = ?, last_message_at = ?, updated_at = unixepoch()
      WHERE id = ? AND (last_message_id IS NULL OR last_message_id <= ?)
    `).bind(messageId, preview, createdAt, identity.conversationId, messageId).run();

    const sender = await this.env.DB.prepare(
      "SELECT full_name AS name FROM student_profiles WHERE id = ?"
    ).bind(identity.userId).first();

    this.broadcast(identity.conversationId, {
      type: "message:new",
      message: {
        id: messageId,
        public_id: String(message.public_id),
        conversation_id: identity.conversationId,
        sender_id: identity.userId,
        client_message_id: clientMessageId,
        body: String(message.body),
        created_at: createdAt,
        delivered_at: message.delivered_at ? Number(message.delivered_at) : null,
        reply_to_status_id: replyToStatusId || null
      }
    });

    const delivered = this.sendToUser(identity.conversationId, other.id, {
      type: "message:delivered", messageId
    });
    if (delivered) {
      await this.env.DB.prepare(
        "UPDATE direct_messages SET delivered_at = COALESCE(delivered_at, unixepoch()) WHERE id = ?"
      ).bind(messageId).run();
      this.sendToUser(identity.conversationId, identity.userId, {
        type: "message:delivery-updated", messageId,
        deliveredAt: Math.floor(Date.now() / 1000)
      });
    }
    const notificationTitle = "New message from " + (sender?.name || "a ClerkMe student");
    // The workspace refreshes last_seen_at every 30 seconds while a student
    // is using ClerkMe. A 90-second window allows for a missed heartbeat but
    // avoids interrupting an active study session with a push alert.
    const recipientPresence = await this.env.DB.prepare(
      "SELECT last_seen_at AS lastSeenAt FROM student_profiles WHERE id = ?"
    ).bind(other.id).first();
    const recipientActive = Number(recipientPresence?.lastSeenAt || 0) >= Math.floor(Date.now() / 1000) - 90;
    if (!delivered && !recipientActive) {
      await this.env.DB.prepare(`
        INSERT INTO student_notifications
          (id, user_id, dedupe_key, kind, title, message, destination, created_at)
        VALUES (?, ?, ?, 'direct_message', ?, 'Open ClerkMe Messages to read it.', 'you', unixepoch())
        ON CONFLICT(dedupe_key) DO UPDATE SET
          title = excluded.title,
          message = excluded.message,
          is_read = 0,
          created_at = excluded.created_at,
          read_at = NULL
      `).bind(
        crypto.randomUUID(), other.id, "direct-message:" + identity.conversationId, notificationTitle
      ).run();
    }

    // Do not alert a student who is already using ClerkMe. Their unread
    // conversation badge remains available; push is reserved for away users.
    if (!recipientActive && !delivered && this.env.PUSH_SERVICE && this.env.PUSH_INTERNAL_TOKEN) {
      try {
        const response = await this.env.PUSH_SERVICE.fetch("https://clerkme-reminders.internal/internal/direct-message", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + this.env.PUSH_INTERNAL_TOKEN,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId: other.id,
            title: notificationTitle,
            body: isVoiceNote ? "You received a voice note on ClerkMe." : "You have a new private message on ClerkMe.",
            url: "/?open=messages",
            tag: "clerkme-dm-" + identity.conversationId,
            messageId,
            conversationId: identity.conversationId
          })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !Number(result.sent)) {
          console.warn("[clerkme-chat] Push handoff returned no delivered alerts.", response.status, result.error || result.reason || "no active subscription");
        }
      } catch (error) {
        console.error("[clerkme-chat] Push notification handoff failed.", error instanceof Error ? error.message : "unknown error");
      }
    } else if (!recipientActive && !delivered) {
      console.error("[clerkme-chat] Push notifications are not configured: PUSH_SERVICE or PUSH_INTERNAL_TOKEN is missing.");
    }
  }

  async handleRead(identity, messageId) {
    if (!Number.isSafeInteger(messageId) || messageId < 1) return;
    const message = await this.env.DB.prepare(
      "SELECT id FROM direct_messages WHERE id = ? AND conversation_id = ? AND deleted_at IS NULL"
    ).bind(messageId, identity.conversationId).first();
    if (!message) return;

    await this.env.DB.prepare(`
      UPDATE direct_conversation_members
      SET last_read_message_id = MAX(COALESCE(last_read_message_id, 0), ?),
          last_read_at = unixepoch()
      WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL
    `).bind(messageId, identity.conversationId, identity.userId).run();

    this.broadcast(identity.conversationId, {
      type: "receipt:read",
      userId: identity.userId,
      lastReadMessageId: messageId,
      readAt: Math.floor(Date.now() / 1000)
    }, identity.userId);
  }
}

export default {
  fetch() {
    return new Response("Not found", { status: 404 });
  }
};
