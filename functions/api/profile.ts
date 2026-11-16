import { nigeriaLgasByState } from "../../lib/nigeria-locations";
import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../_lib/auth";

const profileSelect = "SELECT id, email, full_name AS name, school AS university, level, future_specialty AS futureSpecialty, state, lga FROM student_profiles WHERE id = ?";

type StudentProfile = {
  id: string;
  email: string;
  name: string;
  university: string;
  level: string;
  futureSpecialty: string;
  state: string;
  lga: string;
};

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;

  try {
    const profile = await context.env.DB.prepare(profileSelect).bind(user.id).first<StudentProfile>();
    if (!profile) return json({ error: "Student profile not found. Please sign in again." }, 404);
    return json({ profile });
  } catch (error) {
    console.error("[profile] Unable to load student profile", error);
    return json({ error: "We could not load your profile. Please refresh the page and try again." }, 500);
  }
};

export const onRequestPatch = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin. Refresh the page and try again." }, 403);

  const user = await requireUser(context);
  if (isResponse(user)) return user;

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await context.request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "The profile details were not in a valid format. Please review the form and try again." }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "The profile details could not be read. Please review the form and try again." }, 400);
  }

  const readText = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const name = readText(body.name);
  const university = readText(body.university);
  const level = readText(body.level);
  const futureSpecialty = readText(body.futureSpecialty);
  const state = readText(body.state);
  const lga = readText(body.lga);

  if (name.length < 2 || name.length > 100) return json({ error: "Full name must be between 2 and 100 characters." }, 400);
  if (university.length < 2 || university.length > 150) return json({ error: "Select your university or enter its full name." }, 400);
  if (level.length < 1 || level.length > 80) return json({ error: "Select or enter your current level." }, 400);
  if (futureSpecialty.length > 120) return json({ error: "Future area of specialisation must be 120 characters or fewer." }, 400);
  if (!state || state.length > 120) return json({ error: "Select or enter your state / province." }, 400);
  if (state === "Outside Nigeria" || state === "Outside Nigeria:") {
    return json({ error: "Enter your state or province outside Nigeria." }, 400);
  }
  if (!lga || lga.length > 120) return json({ error: "Select or enter your LGA / local area." }, 400);
  if (nigeriaLgasByState[state] && !nigeriaLgasByState[state].includes(lga)) {
    return json({ error: "The selected LGA does not belong to the selected state. Please choose it again." }, 400);
  }

  try {
    await context.env.DB.prepare(
      "UPDATE student_profiles SET full_name = ?, school = ?, level = ?, future_specialty = ?, state = ?, lga = ?, updated_at = unixepoch() WHERE id = ?"
    ).bind(name, university, level, futureSpecialty, state, lga, user.id).run();

    // Read the saved row back. The UI only displays success after the database confirms it.
    const profile = await context.env.DB.prepare(profileSelect).bind(user.id).first<StudentProfile>();
    if (!profile) return json({ error: "Your account could not be found after saving. Please sign in again." }, 404);

    return json({ profile });
  } catch (error) {
    console.error("[profile] Unable to save student profile", error);
    return json({ error: "Your profile could not be saved at this time. Please check your connection and try again." }, 500);
  }
};
