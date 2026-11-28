import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";
import { areConnected } from "../../_lib/connections";

const allowedTypes=new Map<string,{extension:string;signature:(bytes:Uint8Array)=>boolean}>([
  ["image/jpeg",{extension:"jpg",signature:b=>b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff}],
  ["image/png",{extension:"png",signature:b=>b.length>=8&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47&&b[4]===0x0d&&b[5]===0x0a&&b[6]===0x1a&&b[7]===0x0a}],
  ["image/webp",{extension:"webp",signature:b=>b.length>=12&&String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP"}]
]);
const MAX_PHOTO_SIZE=3*1024*1024;

function stripImageMetadata(bytes:Uint8Array,mimeType:string):Uint8Array {
  const readU32LE=(view:DataView,offset:number)=>view.getUint32(offset,true);
  const writeU32LE=(view:DataView,offset:number,value:number)=>view.setUint32(offset,value,true);
  const chunks:Uint8Array[]=[];

  if(mimeType==="image/jpeg"){
    if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8) throw new Error("Invalid JPEG image.");
    chunks.push(bytes.slice(0,2));
    let offset=2;
    while(offset<bytes.length){
      if(bytes[offset]!==0xff) { chunks.push(bytes.slice(offset)); break; }
      const markerStart=offset;
      while(offset<bytes.length&&bytes[offset]===0xff) offset++;
      if(offset>=bytes.length) break;
      const marker=bytes[offset++];
      if(marker===0xda||marker===0xd9){
        chunks.push(bytes.slice(markerStart));
        break;
      }
      if(marker===0x01||(marker>=0xd0&&marker<=0xd7)){
        chunks.push(bytes.slice(markerStart,offset));
        continue;
      }
      if(offset+2>bytes.length) throw new Error("Invalid JPEG segment.");
      const segmentLength=(bytes[offset]<<8)|bytes[offset+1];
      if(segmentLength<2||offset+segmentLength>bytes.length) throw new Error("Invalid JPEG segment length.");
      const end=offset+segmentLength;
      // APP1 can contain EXIF GPS and XMP. APP13 can contain IPTC location
      // metadata; COM segments may contain user-entered identifying details.
      if(marker!==0xe1&&marker!==0xed&&marker!==0xfe) chunks.push(bytes.slice(markerStart,end));
      offset=end;
    }
    return concat(chunks);
  }

  if(mimeType==="image/png"){
    const signature=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
    if(bytes.length<signature.length||!signature.every((byte,index)=>bytes[index]===byte)) throw new Error("Invalid PNG image.");
    chunks.push(bytes.slice(0,8));
    let offset=8;
    while(offset+12<=bytes.length){
      const view=new DataView(bytes.buffer,bytes.byteOffset+offset,bytes.byteLength-offset);
      const length=view.getUint32(0,false);
      const end=offset+12+length;
      if(end>bytes.length) throw new Error("Invalid PNG chunk length.");
      const type=String.fromCharCode(bytes[offset+4],bytes[offset+5],bytes[offset+6],bytes[offset+7]);
      if(!["eXIf","tEXt","zTXt","iTXt","tIME"].includes(type)) chunks.push(bytes.slice(offset,end));
      offset=end;
      if(type==="IEND") break;
    }
    if(offset!==bytes.length) throw new Error("Invalid PNG structure.");
    return concat(chunks);
  }

  if(mimeType==="image/webp"){
    if(bytes.length<12||String.fromCharCode(...bytes.slice(0,4))!=="RIFF"||String.fromCharCode(...bytes.slice(8,12))!=="WEBP") {
      throw new Error("Invalid WebP image.");
    }
    chunks.push(bytes.slice(0,12));
    let offset=12;
    while(offset+8<=bytes.length){
      const view=new DataView(bytes.buffer,bytes.byteOffset+offset,bytes.byteLength-offset);
      const type=String.fromCharCode(bytes[offset],bytes[offset+1],bytes[offset+2],bytes[offset+3]);
      const length=readU32LE(view,4);
      const end=offset+8+length+(length%2);
      if(end>bytes.length) throw new Error("Invalid WebP chunk length.");
      if(type!=="EXIF"&&type!=="XMP "){
        const chunk=bytes.slice(offset,end);
        if(type==="VP8X"&&length>=1) chunk[8]=chunk[8]&~0x0c;
        chunks.push(chunk);
      }
      offset=end;
    }
    if(offset!==bytes.length) throw new Error("Invalid WebP structure.");
    const output=concat(chunks);
    writeU32LE(new DataView(output.buffer,output.byteOffset,output.byteLength),4,output.length-8);
    return output;
  }

  return bytes;
}

function concat(parts:Uint8Array[]):Uint8Array {
  const length=parts.reduce((total,part)=>total+part.length,0);
  const output=new Uint8Array(length);
  let offset=0;
  for(const part of parts){output.set(part,offset);offset+=part.length;}
  return output;
}

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

  const mimeType=file.type.toLowerCase();
  const key="profile-"+crypto.randomUUID()+"."+detected.extension;
  try{
    const original=new Uint8Array(await file.arrayBuffer());
    const cleanBytes=stripImageMetadata(original,mimeType);
    if(cleanBytes.length<1||cleanBytes.length>MAX_PHOTO_SIZE) return json({error:"The processed profile photo must be 3 MB or smaller."},413);
    const sanitizedFile=new Blob([cleanBytes],{type:mimeType});
    const old=await context.env.DB.prepare(
      "SELECT profile_photo_key AS photoKey FROM student_profiles WHERE id=?"
    ).bind(user.id).first<{photoKey:string|null}>();
    await context.env.STATUS_MEDIA.put(key,sanitizedFile,{
      httpMetadata:{contentType:mimeType},
      customMetadata:{ownerId:user.id,assetType:"profile-photo"}
    });
    await context.env.DB.prepare(
      "UPDATE student_profiles SET profile_photo_key=?,profile_photo_type=?,updated_at=unixepoch() WHERE id=?"
    ).bind(key,mimeType,user.id).run();
    if(old?.photoKey) await context.env.STATUS_MEDIA.delete(old.photoKey).catch(()=>undefined);
    return json({photoUrl:"/api/profile/photo",updated:true,byteSize:cleanBytes.length},201);
  }catch(error){
    await context.env.STATUS_MEDIA.delete(key).catch(()=>undefined);
    console.error("[profile-photo] Upload failed",error instanceof Error?error.message:"unknown error");
    return json({error:"The image could not be safely processed. Please choose another photo."},415);
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
