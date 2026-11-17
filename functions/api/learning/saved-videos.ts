import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validVideoId = (value: string) => /^[A-Za-z0-9_-]{11}$/.test(value);
type SavedRow = {
  id: string; youtube_video_id: string; title: string; description: string; channel_title: string;
  thumbnail_url: string; duration: string; duration_seconds: number; view_count: number;
  like_count: number; folder: string; created_at: number; updated_at: number;
};
const mapVideo = (row: SavedRow) => ({
  savedId: row.id, id: row.youtube_video_id, title: row.title, description: row.description,
  channelTitle: row.channel_title, thumbnailUrl: row.thumbnail_url, duration: row.duration,
  durationSeconds: row.duration_seconds, viewCount: row.view_count, likeCount: row.like_count,
  folder: row.folder, createdAt: row.created_at, updatedAt: row.updated_at
});

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const rows = await context.env.DB.prepare(`
    SELECT id, youtube_video_id, title, description, channel_title, thumbnail_url,
      duration, duration_seconds, view_count, like_count, folder, created_at, updated_at
    FROM saved_learning_videos
    WHERE user_id = ?
    ORDER BY folder COLLATE NOCASE ASC, updated_at DESC
    LIMIT 300
  `).bind(user.id).all<SavedRow>();
  return json({ videos: rows.results.map(mapVideo) });
};

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  let body: Record<string, unknown>;
  try { body = await context.request.json() as Record<string, unknown>; }
  catch { return json({ error: "Invalid request body." }, 400); }

  const videoId = clean(body.videoId, 20);
  const title = clean(body.title, 300);
  const description = clean(body.description, 1200);
  const channelTitle = clean(body.channelTitle, 180);
  const thumbnailUrl = clean(body.thumbnailUrl, 700);
  const folder = clean(body.folder, 60) || "Unsorted";
  const duration = clean(body.duration, 40);
  const durationSeconds = Math.max(0, Math.min(86400, Math.floor(Number(body.durationSeconds) || 0)));
  const viewCount = Math.max(0, Math.min(9007199254740991, Math.floor(Number(body.viewCount) || 0)));
  const likeCount = Math.max(0, Math.min(9007199254740991, Math.floor(Number(body.likeCount) || 0)));

  if (!validVideoId(videoId)) return json({ error: "Choose a valid YouTube video before saving." }, 400);
  if (!title || !channelTitle) return json({ error: "The video title and channel are required." }, 400);
  let thumbnail: URL;
  try { thumbnail = new URL(thumbnailUrl); }
  catch { return json({ error: "The video thumbnail is invalid." }, 400); }
  if (thumbnail.protocol !== "https:" || thumbnail.hostname !== "i.ytimg.com") {
    return json({ error: "Only official YouTube video thumbnails can be saved." }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  await context.env.DB.prepare(`
    INSERT INTO saved_learning_videos
      (id, user_id, youtube_video_id, title, description, channel_title, thumbnail_url,
       duration, duration_seconds, view_count, like_count, folder, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, youtube_video_id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      channel_title = excluded.channel_title,
      thumbnail_url = excluded.thumbnail_url,
      duration = excluded.duration,
      duration_seconds = excluded.duration_seconds,
      view_count = excluded.view_count,
      like_count = excluded.like_count,
      folder = excluded.folder,
      updated_at = excluded.updated_at
  `).bind(id, user.id, videoId, title, description, channelTitle, thumbnail.href,
    duration, durationSeconds, viewCount, likeCount, folder, now, now).run();

  const row = await context.env.DB.prepare(`
    SELECT id, youtube_video_id, title, description, channel_title, thumbnail_url,
      duration, duration_seconds, view_count, like_count, folder, created_at, updated_at
    FROM saved_learning_videos
    WHERE user_id = ? AND youtube_video_id = ?
  `).bind(user.id, videoId).first<SavedRow>();
  if (!row) return json({ error: "The video could not be saved. Please try again." }, 500);
  return json({ video: mapVideo(row) }, 201);
};

export const onRequestDelete = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const id = clean(new URL(context.request.url).searchParams.get("id"), 80);
  if (!id) return json({ error: "Choose a saved video to remove." }, 400);
  const result = await context.env.DB.prepare(
    "DELETE FROM saved_learning_videos WHERE id = ? AND user_id = ?"
  ).bind(id, user.id).run();
  const changes = (result as { meta?: { changes?: number } }).meta?.changes ?? 0;
  if (!changes) return json({ error: "This saved video was not found in your library." }, 404);
  return json({ deleted: true });
};
