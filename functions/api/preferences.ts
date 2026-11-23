import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../_lib/auth";
type ThemePreference = "light" | "dark" | "system";
const isTheme = (value: unknown): value is ThemePreference => value === "light" || value === "dark" || value === "system";
export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const row = await context.env.DB.prepare("SELECT theme_preference AS theme FROM student_profiles WHERE id = ?")
    .bind(user.id).first<{ theme: string }>();
  return json({ preferences: { theme: isTheme(row?.theme) ? row.theme : "system" } });
};
export const onRequestPatch = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  let body: Record<string, unknown>;
  try {
    const value: unknown = await context.request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "Invalid preference update." }, 400);
    body = value as Record<string, unknown>;
  } catch { return json({ error: "Invalid preference update." }, 400); }
  if (!isTheme(body.theme)) return json({ error: "Choose Light, Dark or System appearance." }, 400);
  await context.env.DB.prepare("UPDATE student_profiles SET theme_preference = ?, updated_at = unixepoch() WHERE id = ?")
    .bind(body.theme, user.id).run();
  return json({ preferences: { theme: body.theme } });
};
