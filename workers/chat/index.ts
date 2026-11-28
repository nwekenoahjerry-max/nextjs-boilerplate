interface D1Result { meta?: { changes?: number; last_row_id?: number }; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1Result>;
}
interface D1Database { prepare(sql: string): D1Statement; }
interface DurableSocketState {
  acceptWebSocket(socket: WebSocket): void;
  getWebSockets(): WebSocket[];
}
interface SocketAttachment { userId: string; tokenHash: string; conversationId: string; }
interface AttachedWebSocket extends WebSocket {
  serializeAttachment(value: SocketAttachment): void;
  deserializeAttachment(): SocketAttachment;
}
interface ChatEnv { DB: D1Database; }
declare const WebSocketPair: { new (): { 0: WebSocket; 1: WebSocket } };

const SESSION_COOKIE = "__Host-clerkme_session";
const MAX_MESSAGE_LENGTH = 4000;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function readSessionCookie(request: Request): string | null {
  const cookie = request.headers.get("Cookie") || "";
  const value = cookie.split(";").map(part => part.trim())
    .find(part => part.startsWith(SESSION_COOKIE + "="))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return null; }
}

function safeSend(socket: WebSocket, payload: Record<string, unknown>): boolean {
  try {
    if (socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  } catch { return false; }
}

type AuthenticatedSocket = { userId: string; tokenHash: string; conversationId: string; };
type IncomingMessage = {
  type?: unknown;
  body?: unknown;
  clientMessageId?: unknown;
  messageId?: unknown;
};

export class ConversationRoom {
  constructor(private readonly state: DurableSocketState, private readonly env: ChatEnv) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const origin = request.headers.get("Origin");
    if (!origin) return new Response("Origin is required", { status: 403 });
    try {
      if (new URL(origin).host !== new URL(request.url).host) return new Response("Invalid origin", { status: 403 });
    } catch { return new Response("Invalid origin", { status: 403 }); }

    const requestUrl = new URL(request.url);
    const pathConversationId = requestUrl.pathname.split("/")[3] || "";
    let conversationId = requestUrl.searchParams.get("conversationId") || pathConversationId;
    try { conversationId = decodeURIComponent(conversationId); } catch { return new Response("Conversation not found", { status: 404 }); }
    if (!conversationId || conversationId.length > 80) return new Response("Conversation not found", { status: 404 });

    const token = readSessionCookie(request);
    if (!token) return new Response("Authentication required", { status: 401 });
    const tokenHash = await sha256(token);
    const session = await this.env.DB.prepare(`
      SELECT s.user_id AS userId
      FROM sessions s INNER JOIN student_profiles p ON p.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > unixepoch()
        AND p.email_verified_at IS NOT NULL LIMIT 1
    `).bind(tokenHash).first<{ userId: string }>();
    if (!session) return new Response("Session expired", { status: 401 });

    const membership = await this.env.DB.prepare(`
      SELECT other.user_id AS otherId
      FROM direct_conversation_members me
      INNER JOIN direct_conversation_members other
        ON other.conversation_id = me.conversation_id AND other.user_id <> me.user_id
      WHERE me.conversation_id = ? AND me.user_id = ? AND me.archived_at IS NULL
      LIMIT 1
    `).bind(conversationId, session.userId).first<{ otherId: string }>();
    if (!membership) return new Response("Conversation not found", { status: 404 });

    if (await this.isBlocked(session.userId, membership.otherId)) {
      return new Response("Conversation unavailable", { status: 403 });
    }

    await this.env.DB.prepare("UPDATE student_profiles SET last_seen_at = unixepoch() WHERE id = ?")
      .bind(session.userId).run();

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1] as AttachedWebSocket;
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ userId: session.userId, tokenHash, conversationId });

    this.broadcast(conversationId, {
      type: "presence:update",
      userId: session.userId,
      isOnline: true,
      at: Math.floor(Date.now() / 1000)
    }, session.userId);

    return new Response(null, {
      status: 101,
      webSocket: client
    } as ResponseInit & { webSocket: WebSocket });
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const attached = socket as AttachedWebSocket;
    let identity: AuthenticatedSocket;
    try { identity = attached.deserializeAttachment(); }
    catch { socket.close(1008, "Invalid connection"); return; }

    if (!await this.isSessionActive(identity)) {
      socket.close(1008, "Session expired");
      return;
    }

    const rawText = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    if (rawText.length > MAX_MESSAGE_LENGTH + 2000) {
      safeSend(socket, { type: "error", code: "PAYLOAD_TOO_LARGE", message: "This message is too large." });
      return;
    }

    let payload: IncomingMessage;
    try { payload = JSON.parse(rawText) as IncomingMessage; }
    catch {
      safeSend(socket, { type: "error", code: "INVALID_PAYLOAD", message: "The message could not be read." });
      return;
    }

    if (payload.type === "ping") {
      await this.env.DB.prepare("UPDATE student_profiles SET last_seen_at = unixepoch() WHERE id = ?")
        .bind(identity.userId).run();
      safeSend(socket, { type: "pong", at: Math.floor(Date.now() / 1000) });
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

  async webSocketClose(socket: WebSocket): Promise<void> {
    const attached = socket as AttachedWebSocket;
    let identity: AuthenticatedSocket;
    try { identity = attached.deserializeAttachment(); } catch { return; }
    const remaining = this.state.getWebSockets().some(candidate => {
      try {
        return (candidate as AttachedWebSocket).deserializeAttachment().userId === identity.userId &&
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

  async webSocketError(socket: WebSocket): Promise<void> {
    try { socket.close(1011, "Connection error"); } catch { /* already closed */ }
  }

  private async isSessionActive(identity: AuthenticatedSocket): Promise<boolean> {
    const session = await this.env.DB.prepare(
      "SELECT 1 AS ok FROM sessions WHERE token_hash = ? AND user_id = ? AND expires_at > unixepoch()"
    ).bind(identity.tokenHash, identity.userId).first();
    if (!session) return false;
    const member = await this.env.DB.prepare(
      "SELECT 1 AS ok FROM direct_conversation_members WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL"
    ).bind(identity.conversationId, identity.userId).first();
    return Boolean(member);
  }

  private async isBlocked(userId: string, otherId: string): Promise<boolean> {
    const row = await this.env.DB.prepare(`
      SELECT 1 AS blocked FROM direct_message_blocks
      WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
      LIMIT 1
    `).bind(userId, otherId, otherId, userId).first();
    return Boolean(row);
  }

  private async checkRateLimit(userId: string): Promise<boolean> {
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
    ).bind(bucketHash).first<{ hits: number }>();
    return Number(row?.hits || 0) <= 30;
  }

  private broadcast(conversationId: string, payload: Record<string, unknown>, exceptUserId?: string): void {
    for (const candidate of this.state.getWebSockets()) {
      try {
        const identity = (candidate as AttachedWebSocket).deserializeAttachment();
        if (identity.conversationId !== conversationId || identity.userId === exceptUserId) continue;
        safeSend(candidate, payload);
      } catch { /* Ignore stale attachments. */ }
    }
  }

  private sendToUser(conversationId: string, userId: string, payload: Record<string, unknown>): boolean {
    let delivered = false;
    for (const candidate of this.state.getWebSockets()) {
      try {
        const identity = (candidate as AttachedWebSocket).deserializeAttachment();
        if (identity.conversationId !== conversationId || identity.userId !== userId) continue;
        delivered = safeSend(candidate, payload) || delivered;
      } catch { /* Ignore stale attachments. */ }
    }
    return delivered;
  }

  private async handleNewMessage(
    identity: AuthenticatedSocket,
    payload: IncomingMessage,
    socket: WebSocket
  ): Promise<void> {
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
    ).bind(identity.conversationId, identity.userId).first<{ id: string }>();
    if (!other || await this.isBlocked(identity.userId, other.id)) {
      safeSend(socket, { type: "error", code: "CONVERSATION_UNAVAILABLE", message: "This conversation is unavailable." });
      return;
    }

    let message = await this.env.DB.prepare(`
      SELECT id, public_id, conversation_id, sender_id, client_message_id, body, created_at, delivered_at
      FROM direct_messages WHERE sender_id = ? AND client_message_id = ? LIMIT 1
    `).bind(identity.userId, clientMessageId).first<Record<string, unknown>>();

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
      `).bind(identity.userId, clientMessageId).first<Record<string, unknown>>();
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
    const preview = body.length > 160 ? body.slice(0, 157) + "…" : body;
    await this.env.DB.prepare(`
      UPDATE direct_conversations
      SET last_message_id = ?, last_message_preview = ?, last_message_at = ?, updated_at = unixepoch()
      WHERE id = ? AND (last_message_id IS NULL OR last_message_id <= ?)
    `).bind(messageId, preview, createdAt, identity.conversationId, messageId).run();

    const sender = await this.env.DB.prepare(
      "SELECT full_name AS name FROM student_profiles WHERE id = ?"
    ).bind(identity.userId).first<{ name: string }>();

    const messageEvent = {
      type: "message:new",
      message: {
        id: messageId,
        public_id: String(message.public_id),
        conversation_id: identity.conversationId,
        sender_id: identity.userId,
        client_message_id: clientMessageId,
        body: String(message.body),
        created_at: createdAt,
        delivered_at: message.delivered_at ? Number(message.delivered_at) : null
      }
    };
    this.broadcast(identity.conversationId, messageEvent);

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
    } else {
      await this.env.DB.prepare(`
        INSERT OR IGNORE INTO student_notifications
          (id, user_id, dedupe_key, kind, title, message, destination, created_at)
        VALUES (?, ?, ?, 'direct_message', ?, 'Open ClerkMe Messages to read it.', 'you', unixepoch())
      `).bind(
        crypto.randomUUID(), other.id, "direct-message:" + messageId,
        "New message from " + (sender?.name || "a ClerkMe student")
      ).run();
    }
  }

  private async handleRead(identity: AuthenticatedSocket, messageId: number): Promise<void> {
    if (!Number.isSafeInteger(messageId) || messageId < 1) return;
    const message = await this.env.DB.prepare(
      "SELECT id FROM direct_messages WHERE id = ? AND conversation_id = ? AND deleted_at IS NULL"
    ).bind(messageId, identity.conversationId).first<{ id: number }>();
    if (!message) return;

    await this.env.DB.prepare(`
      UPDATE direct_conversation_members
      SET last_read_message_id = MAX(COALESCE(last_read_message_id, 0), ?),
          last_read_at = unixepoch()
      WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL
    `).bind(messageId, identity.conversationId, identity.userId).run();

    this.broadcast(identity.conversationId, {
      type: "receipt:read", userId: identity.userId,
      lastReadMessageId: messageId, readAt: Math.floor(Date.now() / 1000)
    }, identity.userId);
  }
}
