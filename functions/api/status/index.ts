import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";
import { getStatusPreferences, type StatusAudience } from "../../_lib/status";

const backgrounds = new Set(["#173765","#4C376D","#8A3F51","#23645E","#7A5B2C","#26374D"]);

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  try {
    const expired = await context.env.DB.prepare(
      "SELECT id, media_key FROM status_posts WHERE expires_at <= unixepoch() LIMIT 100"
    ).all<{ id: string; media_key: string | null }>();
    if (expired.results.length) {
      const mediaKeys = expired.results.map(item => item.media_key).filter((key): key is string => Boolean(key));
      if (context.env.STATUS_MEDIA && mediaKeys.length) {
        await Promise.all(mediaKeys.map(key => context.env.STATUS_MEDIA!.delete(key).catch(() => undefined)));
      }
      const ids = expired.results.map(item => item.id);
      await context.env.DB.prepare("DELETE FROM status_posts WHERE id IN (" + ids.map(() => "?").join(",") + ")")
        .bind(...ids).run();
    }
    const stale = await context.env.DB.prepare(
      "SELECT media_key FROM status_media_uploads WHERE created_at <= unixepoch() - 3600 LIMIT 100"
    ).all<{ media_key: string }>();
    if (stale.results.length) {
      const keys = stale.results.map(item => item.media_key);
      if (context.env.STATUS_MEDIA) {
        await Promise.all(keys.map(key => context.env.STATUS_MEDIA!.delete(key).catch(() => undefined)));
      }
      await context.env.DB.prepare("DELETE FROM status_media_uploads WHERE media_key IN (" + keys.map(() => "?").join(",") + ")")
        .bind(...keys).run();
    }

    const rows = await context.env.DB.prepare(
      "SELECT s.id, s.user_id AS userId, p.full_name AS ownerName, p.school AS ownerUniversity, " +
      "s.body, s.background, s.visibility, s.media_key AS mediaKey, s.media_type AS mediaType, " +
      "s.created_at AS createdAt, s.expires_at AS expiresAt, " +
      "(SELECT COUNT(*) FROM status_views v LEFT JOIN status_preferences viewer_pref ON viewer_pref.user_id = v.viewer_id " +
      " WHERE v.status_id = s.id AND COALESCE(viewer_pref.hide_views,0) = 0) AS viewCount, " +
      "EXISTS(SELECT 1 FROM status_views v WHERE v.status_id = s.id AND v.viewer_id = ?) AS hasViewed, " +
      "COALESCE(owner_pref.allow_replies,1) AS allowReplies " +
      "FROM status_posts s INNER JOIN student_profiles p ON p.id = s.user_id " +
      "LEFT JOIN status_preferences owner_pref ON owner_pref.user_id = s.user_id " +
      "WHERE s.expires_at > unixepoch() AND (s.user_id = ? OR (" +
      "p.email_verified_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM direct_message_blocks b WHERE " +
      "(b.blocker_id = ? AND b.blocked_id = s.user_id) OR (b.blocker_id = s.user_id AND b.blocked_id = ?)) " +
      "AND (s.visibility = 'everyone' OR (s.visibility = 'conversations' AND EXISTS (" +
      "SELECT 1 FROM clerkme_student_connections_v1 connection WHERE " +
      "connection.user_low_id = CASE WHEN ? < s.user_id THEN ? ELSE s.user_id END AND " +
      "connection.user_high_id = CASE WHEN ? < s.user_id THEN s.user_id ELSE ? END AND connection.status = 'accepted'))))) " +
      "ORDER BY s.created_at DESC LIMIT 200"
    ).bind(user.id,user.id,user.id,user.id,user.id,user.id,user.id,user.id).all<{
      id:string; userId:string; ownerName:string; ownerUniversity:string; body:string; background:string;
      visibility:StatusAudience; mediaKey:string|null; mediaType:string|null; createdAt:number; expiresAt:number;
      viewCount:number; hasViewed:number; allowReplies:number;
    }>();

    const byUser = new Map<string, { userId:string; name:string; university:string; statuses:unknown[] }>();
    for (const row of rows.results) {
      const group = byUser.get(row.userId) || {
        userId:row.userId, name:row.ownerName, university:row.ownerUniversity, statuses:[]
      };
      group.statuses.push({
        id:row.id, userId:row.userId, body:row.body, background:row.background,
        visibility:row.visibility, mediaKey:row.mediaKey, mediaType:row.mediaType,
        mediaUrl:row.mediaKey ? "/api/status/media/" + encodeURIComponent(row.mediaKey) : null,
        createdAt:row.createdAt, expiresAt:row.expiresAt,
        viewCount:Number(row.viewCount)||0, hasViewed:row.hasViewed===1, allowReplies:row.allowReplies===1
      });
      byUser.set(row.userId,group);
    }
    return json({ groups:Array.from(byUser.values()), userId:user.id });
  } catch (error) {
    console.error("[status] Feed load failed", error);
    return json({ error:"Statuses could not be loaded. Please refresh and try again." },500);
  }
};

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error:"Invalid request origin." },403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  let input: Record<string,unknown>;
  try {
    const value:unknown = await context.request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error:"Enter a status update." },400);
    input = value as Record<string,unknown>;
  } catch { return json({ error:"Enter a status update." },400); }

  const body = typeof input.text === "string" ? input.text.trim().slice(0,500) : "";
  const prefs = await getStatusPreferences(context.env.DB,user.id);
  const candidate = typeof input.visibility === "string" ? input.visibility : prefs.default_audience;
  const visibility:StatusAudience = ["everyone","conversations","only_me"].includes(candidate) ? candidate as StatusAudience : prefs.default_audience;
  const background = typeof input.background === "string" && backgrounds.has(input.background) ? input.background : "#173765";
  const mediaKey = typeof input.mediaKey === "string" ? input.mediaKey.trim() : "";
  let mediaType:string|null = null;
  if (mediaKey) {
    const upload = await context.env.DB.prepare(
      "SELECT media_type AS mediaType FROM status_media_uploads WHERE media_key = ? AND user_id = ? AND created_at > unixepoch() - 3600 LIMIT 1"
    ).bind(mediaKey,user.id).first<{mediaType:string}>();
    if (!upload) return json({ error:"That media upload has expired. Please upload it again." },400);
    mediaType = upload.mediaType;
  }
  if (!body && !mediaKey) return json({ error:"Add text, a photo or a short video before sharing." },400);
  const id = crypto.randomUUID();
  try {
    await context.env.DB.prepare(
      "INSERT INTO status_posts (id,user_id,body,background,visibility,media_key,media_type,created_at,expires_at) " +
      "VALUES (?,?,?,?,?,?,?,unixepoch(),unixepoch()+86400)"
    ).bind(id,user.id,body,background,visibility,mediaKey||null,mediaType).run();
    if (mediaKey) await context.env.DB.prepare(
      "DELETE FROM status_media_uploads WHERE media_key = ? AND user_id = ?"
    ).bind(mediaKey,user.id).run();
    return json({ created:true,id,expiresAt:Math.floor(Date.now()/1000)+86400 },201);
  } catch (error) {
    console.error("[status] Create failed",error);
    return json({ error:"Your status could not be shared. Please try again." },500);
  }
};