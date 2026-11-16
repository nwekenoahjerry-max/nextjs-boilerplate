import { nigeriaLgasByState } from "../../lib/nigeria-locations";
import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../_lib/auth";

const profileSelect = "SELECT id, email, full_name AS name, school AS university, level, future_specialty AS futureSpecialty, state, lga FROM student_profiles WHERE id = ?";

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const profile = await context.env.DB.prepare(profileSelect).bind(user.id).first<{
    id:string; email:string; name:string; university:string; level:string;
    futureSpecialty:string; state:string; lga:string;
  }>();
  if (!profile) return json({ error: "Student profile not found." }, 404);
  return json({ profile });
};

export const onRequestPatch = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;

  let body: { name?: unknown; university?: unknown; level?: unknown; futureSpecialty?: unknown; state?: unknown; lga?: unknown };
  try { body = await context.request.json() as typeof body; }
  catch { return json({ error: "Invalid JSON body." }, 400); }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const university = typeof body.university === "string" ? body.university.trim() : "";
  const level = typeof body.level === "string" ? body.level.trim() : "";
  const futureSpecialty = typeof body.futureSpecialty === "string" ? body.futureSpecialty.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim() : "";
  const lga = typeof body.lga === "string" ? body.lga.trim() : "";

  if (name.length < 2 || name.length > 100) return json({ error: "Full name must be between 2 and 100 characters." }, 400);
  if (university.length < 2 || university.length > 150) return json({ error: "Enter your university or institution." }, 400);
  if (level.length < 1 || level.length > 80) return json({ error: "Select or enter your current level." }, 400);
  if (futureSpecialty.length > 120) return json({ error: "Future area of specialisation must be 120 characters or fewer." }, 400);
  if (!state || state.length > 100) return json({ error: "Select or enter your state / province." }, 400);
  if (!lga || lga.length > 120) return json({ error: "Select or enter your LGA / local area." }, 400);
  if (nigeriaLgasByState[state] && !nigeriaLgasByState[state].includes(lga)) return json({ error: "Choose an LGA that belongs to the selected state." }, 400);

  await context.env.DB.prepare(
    "UPDATE student_profiles SET full_name = ?, school = ?, level = ?, future_specialty = ?, state = ?, lga = ?, updated_at = unixepoch() WHERE id = ?"
  ).bind(name, university, level, futureSpecialty, state, lga, user.id).run();

  const profile = await context.env.DB.prepare(profileSelect).bind(user.id).first();
  return json({ profile });
};
