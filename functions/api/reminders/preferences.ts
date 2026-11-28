import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";
import { PUSH_VAPID_PUBLIC_KEY } from "../../../lib/push-config";

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const [profile, subscriptions] = await Promise.all([
    context.env.DB.prepare("SELECT email_reminders_enabled, message_alerts_enabled FROM student_profiles WHERE id = ?").bind(user.id).first<{ email_reminders_enabled: number; message_alerts_enabled: number }>(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id = ?").bind(user.id).first<{ count: number }>()
  ]);
  return json({ emailRemindersEnabled: profile?.email_reminders_enabled !== 0, messageAlertsEnabled: profile?.message_alerts_enabled !== 0, pushSubscriptions: Number(subscriptions?.count) || 0, vapidPublicKey: context.env.VAPID_PUBLIC_KEY || PUSH_VAPID_PUBLIC_KEY });
};

export const onRequestPatch = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  let body: Record<string, unknown>;
  try { const value: unknown = await context.request.json(); if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "Invalid reminder preference." }, 400); body = value as Record<string, unknown>; }
  catch { return json({ error: "Invalid reminder preference." }, 400); }
  const hasEmailPreference = typeof body.emailRemindersEnabled === "boolean";
  const hasMessagePreference = typeof body.messageAlertsEnabled === "boolean";
  if (!hasEmailPreference && !hasMessagePreference) return json({ error: "Choose a notification preference to update." }, 400);
  if (hasEmailPreference) {
    await context.env.DB.prepare("UPDATE student_profiles SET email_reminders_enabled = ? WHERE id = ?").bind(body.emailRemindersEnabled ? 1 : 0, user.id).run();
  }
  if (hasMessagePreference) {
    await context.env.DB.prepare("UPDATE student_profiles SET message_alerts_enabled = ? WHERE id = ?").bind(body.messageAlertsEnabled ? 1 : 0, user.id).run();
  }
  return json({
    ...(hasEmailPreference ? { emailRemindersEnabled: body.emailRemindersEnabled } : {}),
    ...(hasMessagePreference ? { messageAlertsEnabled: body.messageAlertsEnabled } : {})
  });
};
