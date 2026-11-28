import type { AppContext } from "./auth";

type CommunityAlert = {
  userId: string; dedupeKey: string; kind: "connection_request" | "connection_accepted";
  title: string; message: string; url?: string; tag?: string;
};

export async function notifyStudent(context: AppContext, alert: CommunityAlert): Promise<void> {
  const userId = alert.userId.trim();
  if (!userId) return;
  await context.env.DB.prepare(`
    INSERT INTO student_notifications
      (id, user_id, dedupe_key, kind, title, message, destination, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'you', unixepoch())
    ON CONFLICT(dedupe_key) DO UPDATE SET
      kind = excluded.kind, title = excluded.title, message = excluded.message,
      destination = excluded.destination, is_read = 0, created_at = excluded.created_at,
      read_at = NULL
  `).bind(crypto.randomUUID(), userId, alert.dedupeKey, alert.kind, alert.title, alert.message).run();

  const deliver = async () => {
    const namespace = context.env.CHAT_ROOMS;
    if (!namespace) return;
    try {
      const room = namespace.get(namespace.idFromName("push-user:" + userId));
      const response = await room.fetch(new Request("https://clerkme-chat.internal/internal/push-notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({userId,title:alert.title,body:alert.message,url:alert.url||"/?open=connections",tag:alert.tag||"clerkme-connection-"+userId})
      }));
      if (!response.ok) console.warn("[clerkme-notifications] Device alert handoff returned status", response.status);
    } catch (error) {
      console.warn("[clerkme-notifications] Device alert handoff failed.", error instanceof Error ? error.message : "unknown error");
    }
  };
  const pushPromise = deliver();
  if (context.waitUntil) context.waitUntil(pushPromise);
  else await pushPromise;
}
