import { json, requireUser, isResponse, type AppContext } from "../../../_lib/auth";

export const onRequestGet = async (context: AppContext) => {
  const viewer = await requireUser(context);
  if (isResponse(viewer)) return viewer;
  const userId = (context.params.userId || "").trim();
  if (!userId || userId.length > 100) return json({ error: "Profile photo not found." }, 404);
  const bucket = context.env.STATUS_MEDIA;
  if (!bucket) return json({ error: "Profile photo is unavailable." }, 503);

  const profile = await context.env.DB.prepare(
    "SELECT p.profile_photo_key AS photoKey FROM student_profiles p " +
    "WHERE p.id = ? AND p.email_verified_at IS NOT NULL LIMIT 1"
  ).bind(userId).first<{ photoKey: string | null }>();
  if (!profile?.photoKey || !profile.photoKey.startsWith("profile/" + userId + "/")) {
    return json({ error: "Profile photo not found." }, 404);
  }

  const object = await bucket.get(profile.photoKey);
  if (!object) return json({ error: "Profile photo not found." }, 404);
  const contentType = object.httpMetadata?.contentType || "application/octet-stream";
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    return json({ error: "Profile photo not found." }, 404);
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(object.size),
      "Cache-Control": "private, max-age=300, must-revalidate",
      "Vary": "Cookie",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline"
    }
  });
};
