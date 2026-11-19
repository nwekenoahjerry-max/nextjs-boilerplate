import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
  };
};
type YouTubeDetailsItem = {
  id?: string;
  status?: { embeddable?: boolean };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string };
};
function durationSeconds(value: string) {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}
function durationLabel(value: string) {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return "";
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return [hours ? hours + "h" : "", minutes ? minutes + "m" : "", !hours && !minutes && seconds ? seconds + "s" : ""].filter(Boolean).join(" ") || (hours || minutes ? "" : "Short video");
}

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  let body: Record<string, unknown>;
  try { body = await context.request.json() as Record<string, unknown>; }
  catch { return json({ error: "Invalid request body." }, 400); }

  const query = clean(body.query, 120);
  const orderValue = clean(body.order, 20);
  const order = ["relevance", "viewCount", "date"].includes(orderValue) ? orderValue : "relevance";
  if (query.length < 2) return json({ error: "Enter a topic to search for." }, 400);
  const apiKey = context.env.YOUTUBE_API_KEY;
  if (!apiKey) return json({
    error: "In-app video search needs a YouTube Data API key, which has not been configured yet. You can still paste a YouTube video link above and play it inside ClerkMe."
  }, 503);

  const params = new URLSearchParams({
    key: apiKey,
    part: "snippet",
    q: query,
    type: "video",
    videoEmbeddable: "true",
    maxResults: "5",
    regionCode: "NG",
    relevanceLanguage: "en",
    safeSearch: "strict",
    order
  });
  try {
    const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params.toString(), {
      headers: { Accept: "application/json" }
    });
    const data = await response.json().catch(() => ({})) as {
      items?: YouTubeSearchItem[];
      error?: { message?: string; errors?: Array<{ reason?: string }> };
    };
    if (!response.ok) {
      const reason = data.error?.errors?.[0]?.reason;
      if (response.status === 403 && (reason === "quotaExceeded" || reason === "dailyLimitExceeded")) {
        return json({ error: "ClerkMe's video-search allowance has been reached. Try again after the YouTube API quota resets." }, 429);
      }
      if (response.status === 403 && (reason === "keyInvalid" || reason === "accessNotConfigured")) {
        return json({ error: "YouTube search could not authenticate. Check that the Cloudflare YOUTUBE_API_KEY secret contains a valid key and that YouTube Data API v3 is enabled." }, 502);
      }
      return json({ error: "YouTube video search is temporarily unavailable. Paste a video link to play it inside ClerkMe." }, 502);
    }

    const searchItems = (Array.isArray(data.items) ? data.items : []).filter(item => /^[A-Za-z0-9_-]{11}$/.test(clean(item.id?.videoId, 32)));
    const ids = searchItems.map(item => clean(item.id?.videoId, 32));
    const detailsById = new Map<string, YouTubeDetailsItem>();
    if (ids.length) {
      const detailParams = new URLSearchParams({ key: apiKey, part: "contentDetails,statistics,status", id: ids.join(",") });
      const detailsResponse = await fetch("https://www.googleapis.com/youtube/v3/videos?" + detailParams.toString(), {
        headers: { Accept: "application/json" }
      });
      if (detailsResponse.ok) {
        const detailData = await detailsResponse.json().catch(() => ({})) as { items?: YouTubeDetailsItem[] };
        for (const item of detailData.items || []) if (item.id) detailsById.set(item.id, item);
      }
    }

    const videos = searchItems.map(item => {
      const id = clean(item.id?.videoId, 32);
      const snippet = item.snippet || {};
      const detail = detailsById.get(id);
      const thumbnailUrl = clean(snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url, 600);
      return {
        id,
        title: clean(snippet.title, 300) || "Untitled video",
        description: clean(snippet.description, 900),
        channelTitle: clean(snippet.channelTitle, 180) || "YouTube channel",
        publishedAt: clean(snippet.publishedAt, 50),
        thumbnailUrl,
        duration: durationLabel(detail?.contentDetails?.duration || ""),
        durationSeconds: durationSeconds(detail?.contentDetails?.duration || ""),
        viewCount: Math.max(0, Number(detail?.statistics?.viewCount) || 0),
        likeCount: Math.max(0, Number(detail?.statistics?.likeCount) || 0)
      };
    }).filter(video => video.thumbnailUrl.startsWith("https://") && (detailsById.size === 0 || detailsById.get(video.id)?.status?.embeddable !== false));
    return json({ videos });
  } catch {
    return json({ error: "Could not connect to YouTube video search. Please try again." }, 502);
  }
};
