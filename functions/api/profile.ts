import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../_lib/auth";

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const profile = await context.env.DB.prepare(
    "SELECT id, email, full_name AS name, school, level FROM student_profiles WHERE id = ?"
  ).bind(user.id).first<{ id: string; email: string; name: string; school: string; level: string }>();
  if (!profile) return json({ error: "Student profile not found." }, 404);
  return json({ profile });
};

export const onRequestPatch = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;

  let body: { name?: unknown; school?: unknown; level?: unknown };
  try { body = await context.request.json() as typeof body; }
  catch { return json({ error: "Invalid JSON body." }, 400); }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const school = typeof body.school === "string" ? body.school.trim() : "";
  const level = typeof body.level === "string" ? body.level.trim() : "";

  if (name.length < 2 || name.length > 100) return json({ error: "Full name must be between 2 and 100 characters." }, 400);
  if (school.length > 150) return json({ error: "Institution must be 150 characters or fewer." }, 400);
  if (level.length > 80) return json({ error: "Academic level must be 80 characters or fewer." }, 400);

  await context.env.DB.prepare(
    "UPDATE student_profiles SET full_name = ?, school = ?, level = ?, updated_at = unixepoch() WHERE id = ?"
  ).bind(name, school, level, user.id).run();

  const profile = await context.env.DB.prepare(
    "SELECT id, email, full_name AS name, school, level FROM student_profiles WHERE id = ?"
  ).bind(user.id).first();
  return json({ profile });
};
