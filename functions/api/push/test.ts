import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const namespace = context.env.CHAT_ROOMS;
  if (!namespace) return json({ error: "The notification service is not configured for this environment." }, 503);
  try {
    const room = namespace.get(namespace.idFromName("push-test:" + user.id));
    const response = await room.fetch(new Request("https://clerkme-chat.internal/internal/push-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id })
    }));
    const data = await response.json().catch(() => ({}));
    return json(data, response.status);
  } catch (error) {
    console.error("[clerkme-push-test] Test delivery failed.", error instanceof Error ? error.message : "unknown error");
    return json({ error: "The notification service could not be reached. Please try again." }, 502);
  }
};
