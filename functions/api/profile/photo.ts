import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;

function validImageSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (type === "image/webp") {
    const read = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
    return bytes.length >= 12 && read(0, 4) === "RIFF" && read(8, 12) === "WEBP";
  }
  return false;
}

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid upload origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const bucket = context.env.STATUS_MEDIA;
  if (!bucket) return json({ error: "Profile photo storage is not available in this environment yet." }, 503);

  const declaredLength = Number(context.request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_PROFILE_PHOTO_BYTES + 64 * 1024) {
    return json({ error: "Profile photos must be 2 MB or smaller after image optimisation." }, 413);
  }

  let form: FormData;
  try { form = await context.request.formData(); }
  catch { return json({ error: "Choose a profile photo to upload." }, 400); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1) return json({ error: "Choose a profile photo to upload." }, 400);
  if (file.size > MAX_PROFILE_PHOTO_BYTES) return json({ error: "Profile photos must be 2 MB or smaller." }, 413);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return json({ error: "Use a JPG, PNG or WebP image for your profile photo." }, 415);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validImageSignature(file.type, bytes)) {
    return json({ error: "This file is not a valid JPG, PNG or WebP image." }, 415);
  }
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const newKey = "profile/" + user.id + "/" + crypto.randomUUID() + "." + extension;

  try {
    const current = await context.env.DB.prepare(
      "SELECT photo_key AS photoKey FROM clerkme_profile_photos_v1 WHERE user_id = ? LIMIT 1"
    ).bind(user.id).first<{ photoKey: string }>();
    await bucket.put(newKey, bytes, {
      httpMetadata: { contentType: file.type },
      customMetadata: { ownerId: user.id, purpose: "profile-photo" }
    });
    await context.env.DB.prepare(
      "INSERT INTO clerkme_profile_photos_v1 (user_id, photo_key, content_type, updated_at) " +
      "VALUES (?, ?, ?, unixepoch()) " +
      "ON CONFLICT(user_id) DO UPDATE SET photo_key = excluded.photo_key, " +
      "content_type = excluded.content_type, updated_at = unixepoch()"
    ).bind(user.id, newKey, file.type).run();

    if (current?.photoKey) await bucket.delete(current.photoKey).catch(error => {
      console.warn("[profile-photo] Previous image cleanup failed.", error instanceof Error ? error.message : "unknown error");
    });
    const version = Math.floor(Date.now() / 1000);
    return json({ uploaded: true, profilePhotoUrl: "/api/profile/photo/" + encodeURIComponent(user.id) + "?v=" + version }, 201);
  } catch (error) {
    await bucket.delete(newKey).catch(() => undefined);
    console.error("[profile-photo] Upload failed.", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Your profile photo could not be saved. Please try again." }, 500);
  }
};

export const onRequestDelete = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid upload origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const bucket = context.env.STATUS_MEDIA;
  if (!bucket) return json({ error: "Profile photo storage is not available in this environment yet." }, 503);

  const current = await context.env.DB.prepare(
    "SELECT photo_key AS photoKey FROM clerkme_profile_photos_v1 WHERE user_id = ? LIMIT 1"
  ).bind(user.id).first<{ photoKey: string }>();
  if (!current) return json({ removed: true, profilePhotoUrl: null });

  await context.env.DB.prepare(
    "DELETE FROM clerkme_profile_photos_v1 WHERE user_id = ?"
  ).bind(user.id).run();
  await bucket.delete(current.photoKey).catch(error => {
    console.warn("[profile-photo] Removed image cleanup failed.", error instanceof Error ? error.message : "unknown error");
  });
  return json({ removed: true, profilePhotoUrl: null });
};
