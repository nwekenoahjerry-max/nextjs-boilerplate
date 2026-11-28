import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";
import { areConnected } from "../../_lib/connections";

const allowedTypes=new Map<string,{extension:string;signature:(bytes:Uint8Array)=>boolean}>([
  ["image/jpeg",{extension:"jpg",signature:b=>b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff}],
  ["image/png",{extension:"png",signature:b=>b.length>=8&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47&&b[4]===0x0d&&b[5]===0x0a&&b[6]===0x1a&&b[7]===0x0a}],
  ["image/webp",{extension:"webp",signature:b=>b.length>=12&&String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP"}]
]);
const MAX_PHOTO_SIZE=3*1024*1024;

export const onRequestGet=async(context:AppContext)=>{
  const user=await requireUser(context);
  if(isResponse(user)) return user;
  const url=new URL(context.request.url);
  const requestedId=(url.searchParams.get("userId")||user.id).trim();
  if(!requestedId||requestedId.length>100) return json({error:"Profile photo not found."},404);
  if(requestedId!==user.id){
    if(!await areConnected(context.env.DB,user.id,requestedId)) return json({error:"Profile photo not found."},404);
    const blocked=await context.env.DB.prepare(`
      SELECT 1 AS ok FROM direct_message_blocks
      WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?) LIMIT 1
    `).bind(user.id,requestedId,requestedId,user.id).first();
    if(blocked) return json({error:"Profile photo not found."},404);
  }
  const profile=await context.env.DB.prepare(
    "SELECT profile_photo_key AS photoKey,profile_photo_type AS photoType FROM student_profiles WHERE id=?"
  ).bind(requestedId).first<{photoKey:string|null;photoType:string|null}>();
  if(!profile?.photoKey||!context.env.STATUS_MEDIA) return json({error:"Profile photo not found."},404);
  const object=await context.env.STATUS_MEDIA.get(profile.photoKey);
  if(!object) return json({error:"Profile photo not found."},404);
  const contentType=allowedTypes.has(profile.photoType||"")?profile.photoType!:"application/octet-stream";
  if(contentType==="application/octet-stream") return json({error:"Profile photo not found."},404);
  return new Response(object.body,{
    headers:{
      "Content-Type":contentType,
      "Content-Length":String(object.size),
      "Cache-Control":"private, no-store",
      "X-Content-Type-Options":"nosniff",
      "Content-Security-Policy":"default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy":"same-origin",
      "Content-Disposition":"inline"
    }
  });
};

export const onRequestPost=async(context:AppContext)=>{
  if(!validSameOrigin(context.request)) return json({error:"Invalid upload origin."},403);
  const user=await requireUser(context);
  if(isResponse(user)) return user;
  if(!context.env.STATUS_MEDIA) return json({error:"Profile photo storage is not available yet."},503);
  const declared=Number(context.request.headers.get("Content-Length")||0);
  if(declared>MAX_PHOTO_SIZE+16*1024) return json({error:"Profile photos must be 3 MB or smaller."},413);
  let form:FormData;
  try{form=await context.request.formData();}
  catch{return json({error:"Choose a profile photo to upload."},400);}
  const file=form.get("file");
  if(!(file instanceof File)) return json({error:"Choose a profile photo to upload."},400);
  if(file.size<1||file.size>MAX_PHOTO_SIZE) return json({error:"Profile photos must be 3 MB or smaller."},413);
  const detected=allowedTypes.get(file.type.toLowerCase());
  if(!detected) return json({error:"Use a JPG, PNG or WebP image. SVG and animated files are not supported."},415);
  const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
  if(!detected.signature(header)) return json({error:"The image contents do not match the selected file type."},415);

  const old=await context.env.DB.prepare(
    "SELECT profile_photo_key AS photoKey FROM student_profiles WHERE id=?"
  ).bind(user.id).first<{photoKey:string|null}>();
  const key="profile-"+crypto.randomUUID()+"."+detected.extension;
  try{
    await context.env.STATUS_MEDIA.put(key,file,{
      httpMetadata:{contentType:file.type.toLowerCase()},
      customMetadata:{ownerId:user.id,assetType:"profile-photo"}
    });
    await context.env.DB.prepare(
      "UPDATE student_profiles SET profile_photo_key=?,profile_photo_type=?,updated_at=unixepoch() WHERE id=?"
    ).bind(key,file.type.toLowerCase(),user.id).run();
    if(old?.photoKey) await context.env.STATUS_MEDIA.delete(old.photoKey).catch(()=>undefined);
    return json({photoUrl:"/api/profile/photo",updated:true,byteSize:file.size},201);
  }catch(error){
    await context.env.STATUS_MEDIA.delete(key).catch(()=>undefined);
    console.error("[profile-photo] Upload failed",error instanceof Error?error.message:"unknown error");
    return json({error:"Your profile photo could not be saved. Please try again."},500);
  }
};

export const onRequestDelete=async(context:AppContext)=>{
  if(!validSameOrigin(context.request)) return json({error:"Invalid request origin."},403);
  const user=await requireUser(context);
  if(isResponse(user)) return user;
  const old=await context.env.DB.prepare(
    "SELECT profile_photo_key AS photoKey FROM student_profiles WHERE id=?"
  ).bind(user.id).first<{photoKey:string|null}>();
  await context.env.DB.prepare(
    "UPDATE student_profiles SET profile_photo_key=NULL,profile_photo_type=NULL,updated_at=unixepoch() WHERE id=?"
  ).bind(user.id).run();
  if(old?.photoKey&&context.env.STATUS_MEDIA) await context.env.STATUS_MEDIA.delete(old.photoKey).catch(()=>undefined);
  return json({removed:true,photoUrl:null});
};
