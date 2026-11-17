import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

const clean=(value:unknown,max:number)=>typeof value==="string"?value.trim().slice(0,max):"";

type YouTubeSearchItem={
  id?:{videoId?:string};
  snippet?:{
    title?:string;
    description?:string;
    channelTitle?:string;
    publishedAt?:string;
    thumbnails?:{high?:{url?:string};medium?:{url?:string};default?:{url?:string}};
  };
};

export const onRequestPost=async(context:AppContext)=>{
  if(!validSameOrigin(context.request)) return json({error:"Invalid request origin."},403);
  const user=await requireUser(context);
  if(isResponse(user)) return user;
  let body:Record<string,unknown>;
  try { body=await context.request.json() as Record<string,unknown>; }
  catch { return json({error:"Invalid request body."},400); }

  const query=clean(body.query,120);
  if(query.length<2) return json({error:"Enter a topic to search for."},400);
  const apiKey=context.env.YOUTUBE_API_KEY;
  if(!apiKey) return json({
    error:"In-app video search needs a YouTube Data API key, which has not been configured yet. You can still paste a YouTube video link above and play it inside ClerkMe."
  },503);

  const params=new URLSearchParams({
    key:apiKey,
    part:"snippet",
    q:query,
    type:"video",
    videoEmbeddable:"true",
    maxResults:"8",
    regionCode:"NG",
    relevanceLanguage:"en",
    safeSearch:"strict",
    order:"relevance"
  });
  try {
    const response=await fetch("https://www.googleapis.com/youtube/v3/search?"+params.toString(),{
      headers:{Accept:"application/json"}
    });
    const data=await response.json().catch(()=>({})) as {
      items?:YouTubeSearchItem[];
      error?:{message?:string;errors?:Array<{reason?:string}>};
    };
    if(!response.ok) {
      const reason=data.error?.errors?.[0]?.reason;
      if(response.status===403&&(reason==="quotaExceeded"||reason==="dailyLimitExceeded")) {
        return json({error:"ClerkMe's video-search allowance has been reached. Try again after the YouTube API quota resets."},429);
      }
      return json({error:"YouTube video search is temporarily unavailable. Paste a video link to play it inside ClerkMe."},502);
    }
    const videos=(Array.isArray(data.items)?data.items:[]).map(item=>{
      const id=clean(item.id?.videoId,32);
      const snippet=item.snippet||{};
      return {
        id,
        title:clean(snippet.title,300)||"Untitled video",
        description:clean(snippet.description,700),
        channelTitle:clean(snippet.channelTitle,180)||"YouTube channel",
        publishedAt:clean(snippet.publishedAt,50),
        thumbnailUrl:clean(snippet.thumbnails?.high?.url||snippet.thumbnails?.medium?.url||snippet.thumbnails?.default?.url,600)
      };
    }).filter(video=>/^[A-Za-z0-9_-]{11}$/.test(video.id)&&video.thumbnailUrl.startsWith("https://"));
    return json({videos});
  } catch {
    return json({error:"Could not connect to YouTube video search. Please try again."},502);
  }
};
