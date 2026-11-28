import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

const allowed = new Map<string,string>([
  ["image/jpeg","jpg"],["image/png","png"],["image/webp","webp"],["image/gif","gif"],
  ["video/mp4","mp4"],["video/webm","webm"]
]);

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error:"Invalid upload origin." },403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  if (!context.env.STATUS_MEDIA) return json({ error:"Status media storage is not available in this environment yet." },503);

  let form:FormData;
  try { form = await context.request.formData(); }
  catch { return json({ error:"Choose a photo or video to upload." },400); }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error:"Choose a photo or video to upload." },400);
  const extension = allowed.get(file.type);
  if (!extension) return json({ error:"Use a JPG, PNG, WebP or GIF image, or an MP4 / WebM video." },415);
  const isVideo = file.type.startsWith("video/");
  const maxSize = isVideo ? 25*1024*1024 : 8*1024*1024;
  if (file.size < 1 || file.size > maxSize) {
    return json({ error:isVideo ? "Short videos must be 25 MB or smaller." : "Photos must be 8 MB or smaller." },413);
  }
  const mediaKey = crypto.randomUUID() + "." + extension;
  try {
    await context.env.STATUS_MEDIA.put(mediaKey,file,{
      httpMetadata:{contentType:file.type},
      customMetadata:{ownerId:user.id}
    });
    await context.env.DB.prepare(
      "INSERT INTO status_media_uploads (media_key,user_id,media_type,byte_size,created_at) VALUES (?,?,?,?,unixepoch())"
    ).bind(mediaKey,user.id,file.type,file.size).run();
    return json({ mediaKey,mediaType:file.type,byteSize:file.size },201);
  } catch (error) {
    await context.env.STATUS_MEDIA.delete(mediaKey).catch(()=>undefined);
    console.error("[status] Upload failed",error);
    return json({ error:"Your media could not be uploaded. Please try again." },500);
  }
};