import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../../_lib/auth";
import { sortedStudentPair } from "../../../_lib/connections";

export const onRequestPatch=async(context:AppContext)=>{
  if(!validSameOrigin(context.request)) return json({error:"Invalid request origin."},403);
  const user=await requireUser(context);
  if(isResponse(user)) return user;
  const requestId=(context.params.requestId||"").trim();
  if(!requestId||requestId.length>80) return json({error:"Connection request not found."},404);
  let body:{action?:unknown};
  try{body=await context.request.json() as {action?:unknown};}
  catch{return json({error:"Choose an action for this request."},400);}
  const action=typeof body.action==="string"?body.action:"";
  if(!["accept","decline","cancel"].includes(action)) return json({error:"Choose accept, decline or cancel."},400);
  const request=await context.env.DB.prepare(`
    SELECT id,sender_id AS senderId,recipient_id AS recipientId,status
    FROM student_connection_requests WHERE id=? LIMIT 1
  `).bind(requestId).first<{id:string;senderId:string;recipientId:string;status:string}>();
  if(!request||request.status!=="pending") return json({error:"This request is no longer pending."},404);
  if(action==="accept"||action==="decline"){
    if(request.recipientId!==user.id) return json({error:"Only the recipient can respond to this request."},403);
  }else if(request.senderId!==user.id){
    return json({error:"Only the sender can cancel this request."},403);
  }
  if(action==="accept"){
    const [userA,userB]=sortedStudentPair(request.senderId,request.recipientId);
    const blocked=await context.env.DB.prepare(`
      SELECT 1 AS ok FROM direct_message_blocks
      WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?) LIMIT 1
    `).bind(request.senderId,request.recipientId,request.recipientId,request.senderId).first();
    if(blocked) return json({error:"This request cannot be accepted because the accounts are blocked."},403);
    await context.env.DB.prepare(
      "INSERT OR IGNORE INTO student_connections (user_a_id,user_b_id,created_at) VALUES (?,?,unixepoch())"
    ).bind(userA,userB).run();
    const reverse=await context.env.DB.prepare(
      "SELECT id FROM student_connection_requests WHERE sender_id=? AND recipient_id=? AND status='pending' LIMIT 1"
    ).bind(request.recipientId,request.senderId).first<{id:string}>();
    await context.env.DB.prepare(`
      UPDATE student_connection_requests SET status='accepted',updated_at=unixepoch()
      WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)
    `).bind(request.senderId,request.recipientId,request.recipientId,request.senderId).run();
    await context.env.DB.prepare(
      "UPDATE student_notifications SET is_read=1,read_at=unixepoch() WHERE user_id=? AND dedupe_key=?"
    ).bind(user.id,"connection-request:"+request.id).run();
    if(reverse){
      await context.env.DB.prepare(
        "UPDATE student_notifications SET is_read=1,read_at=unixepoch() WHERE user_id=? AND dedupe_key=?"
      ).bind(request.senderId,"connection-request:"+reverse.id).run();
    }
    return json({status:"connected",connected:true});
  }
  const next=action==="decline"?"declined":"cancelled";
  await context.env.DB.prepare(
    "UPDATE student_connection_requests SET status=?,updated_at=unixepoch() WHERE id=? AND status='pending'"
  ).bind(next,request.id).run();
  if(action==="decline"){
    await context.env.DB.prepare(
      "UPDATE student_notifications SET is_read=1,read_at=unixepoch() WHERE user_id=? AND dedupe_key=?"
    ).bind(user.id,"connection-request:"+request.id).run();
  }else{
    await context.env.DB.prepare(
      "UPDATE student_notifications SET is_read=1,read_at=unixepoch() WHERE user_id=? AND dedupe_key=?"
    ).bind(request.recipientId,"connection-request:"+request.id).run();
  }
  return json({status:next});
};
