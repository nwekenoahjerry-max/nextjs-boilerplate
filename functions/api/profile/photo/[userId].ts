import { json, requireUser, isResponse, type AppContext } from "../../../_lib/auth";

export const onRequestGet = async (context: AppContext) => {
  const viewer = await requireUser(context);
  if (isResponse(viewer)) return viewer;
  const userId = (context.params.userId || "").trim();
  if (!userId || userId.length > 100) return json({ error: "Profile photo not found." }, 404);
  const bucket = context.env.STATUS_MEDIA;
  if (!bucket) return json({ error: "Profile photo is unavailable." }, 503);

  const photo = await context.env.DB.prepare(
    "SELECT photos.photo_key AS photoKey, photos.content_type AS contentType " +
    "FROM clerkme_profile_photos_v1 photos " +
    "INNER JOIN student_profiles p ON p.id = photos.user_id " +
    "WHERE photos.user_id = ? AND p.email_verified_at IS NOT NULL LIMIT 1"
  ).bind(userId).first<{ photoKey: string; contentType: string }>();
  if (!photo || !photo.photoKey.startsWith("profile/" + userId + "/")) {
    return json({ error: "Profile photo not found." }, 404);
  }

  const object = await bucket.get(photo.photoKey);
  if (!object) return json({ error: "Profile photo not found." }, 404);
  const contentType = object.httpMetadata?.contentType || photo.contentType;
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
