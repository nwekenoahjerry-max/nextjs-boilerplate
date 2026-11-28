import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";
import { sortedStudentPair } from "../../_lib/connections";

type PersonRow={id:string;name:string;university:string;level:string;profilePhotoKey:string|null;requestId?:string;createdAt?:number};

export const onRequestGet=async(context:AppContext)=>{
  const user=await requireUser(context);
  if(isResponse(user)) return user;
  const [connections,incoming,outgoing]=await Promise.all([
    context.env.DB.prepare(`
      SELECT p.id,p.full_name AS name,p.school AS university,p.level,
        p.profile_photo_key AS profilePhotoKey,c.created_at AS createdAt
      FROM student_connections c
      INNER JOIN student_profiles p ON p.id=CASE WHEN c.user_a_id=? THEN c.user_b_id ELSE c.user_a_id END
      WHERE (c.user_a_id=? OR c.user_b_id=?)
        AND NOT EXISTS (
          SELECT 1 FROM direct_message_blocks b
          WHERE (b.blocker_id=? AND b.blocked_id=p.id)
             OR (b.blocker_id=p.id AND b.blocked_id=?)
        )
      ORDER BY p.full_name COLLATE NOCASE LIMIT 200
    `).bind(user.id,user.id,user.id,user.id,user.id).all<PersonRow>(),
    context.env.DB.prepare(`
      SELECT r.id AS requestId,r.created_at AS createdAt,p.id,p.full_name AS name,
        p.school AS university,p.level,NULL AS profilePhotoKey
      FROM student_connection_requests r INNER JOIN student_profiles p ON p.id=r.sender_id
      WHERE r.recipient_id=? AND r.status='pending'
      ORDER BY r.created_at DESC LIMIT 50
    `).bind(user.id).all<PersonRow>(),
    context.env.DB.prepare(`
      SELECT r.id AS requestId,r.created_at AS createdAt,p.id,p.full_name AS name,
        p.school AS university,p.level,NULL AS profilePhotoKey
      FROM student_connection_requests r INNER JOIN student_profiles p ON p.id=r.recipient_id
      WHERE r.sender_id=? AND r.status='pending'
      ORDER BY r.created_at DESC LIMIT 50
    `).bind(user.id).all<PersonRow>()
  ]);
  const photoUrl=(key:string|null,id:string)=>key?"/api/profile/photo?userId="+encodeURIComponent(id):null;
  return json({
    connections:connections.results.map(item=>({id:item.id,name:item.name,university:item.university,level:item.level,createdAt:item.createdAt,photoUrl:photoUrl(item.profilePhotoKey,item.id)})),
    incoming:incoming.results,
    outgoing:outgoing.results,
    incomingCount:incoming.results.length
  });
};

export const onRequestPost=async(context:AppContext)=>{
  if(!validSameOrigin(context.request)) return json({error:"Invalid request origin."},403);
  const user=await requireUser(context);
  if(isResponse(user)) return user;
  let body:{recipientId?:unknown};
  try{body=await context.request.json() as {recipientId?:unknown};}
  catch{return json({error:"Choose a student to connect with."},400);}
  const recipientId=typeof body.recipientId==="string"?body.recipientId.trim():"";
  if(!recipientId||recipientId.length>100||recipientId===user.id) return json({error:"Choose a valid student."},400);
  const recipient=await context.env.DB.prepare(
    "SELECT id FROM student_profiles WHERE id=? AND email_verified_at IS NOT NULL"
  ).bind(recipientId).first<{id:string}>();
  if(!recipient) return json({error:"That verified student account could not be found."},404);
  const blocked=await context.env.DB.prepare(`
    SELECT 1 AS ok FROM direct_message_blocks
    WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?) LIMIT 1
  `).bind(user.id,recipientId,recipientId,user.id).first();
  if(blocked) return json({error:"A connection request cannot be sent to this account."},403);
  const [userA,userB]=sortedStudentPair(user.id,recipientId);
  const connected=await context.env.DB.prepare(
    "SELECT 1 AS ok FROM student_connections WHERE user_a_id=? AND user_b_id=? LIMIT 1"
  ).bind(userA,userB).first();
  if(connected) return json({status:"connected",connected:true});

  const reciprocal=await context.env.DB.prepare(`
    SELECT id FROM student_connection_requests
    WHERE sender_id=? AND recipient_id=? AND status='pending' LIMIT 1
  `).bind(recipientId,user.id).first<{id:string}>();
  const ownPending=await context.env.DB.prepare(
    "SELECT id FROM student_connection_requests WHERE sender_id=? AND recipient_id=? AND status='pending' LIMIT 1"
  ).bind(user.id,recipientId).first<{id:string}>();
  if(ownPending) return json({status:"pending",requestId:ownPending.id,alreadyPending:true});
  const recentRequests=await context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM student_connection_requests WHERE sender_id=? AND created_at>=unixepoch()-3600"
  ).bind(user.id).first<{count:number}>();
  if(Number(recentRequests?.count||0)>=30) return json({error:"You have reached the hourly connection-request limit. Please try again later."},429);

  if(reciprocal){
    await context.env.DB.prepare(
      "INSERT OR IGNORE INTO student_connections (user_a_id,user_b_id,created_at) VALUES (?,?,unixepoch())"
    ).bind(userA,userB).run();
    const ownRequest=await context.env.DB.prepare(
      "SELECT id FROM student_connection_requests WHERE sender_id=? AND recipient_id=? AND status='pending' LIMIT 1"
    ).bind(user.id,recipientId).first<{id:string}>();
    await context.env.DB.prepare(`
      UPDATE student_connection_requests SET status='accepted',updated_at=unixepoch()
      WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)
    `).bind(user.id,recipientId,recipientId,user.id).run();
    if(ownRequest){
      await context.env.DB.prepare(
        "UPDATE student_notifications SET is_read=1,read_at=unixepoch() WHERE user_id=? AND dedupe_key=?"
      ).bind(recipientId,"connection-request:"+ownRequest.id).run();
    }
    await context.env.DB.prepare(
      "UPDATE student_notifications SET is_read=1,read_at=unixepoch() WHERE user_id=? AND dedupe_key=?"
    ).bind(user.id,"connection-request:"+reciprocal.id).run();
    return json({status:"connected",connected:true,reciprocalAccepted:true});
  }

  await context.env.DB.prepare(`
    INSERT INTO student_connection_requests (id,sender_id,recipient_id,status,created_at,updated_at)
    VALUES (?,?,?,'pending',unixepoch(),unixepoch())
    ON CONFLICT(sender_id,recipient_id) DO UPDATE SET
      status='pending',updated_at=unixepoch(),created_at=unixepoch()
    WHERE student_connection_requests.status IN ('declined','cancelled')
  `).bind(crypto.randomUUID(),user.id,recipientId).run();
  const request=await context.env.DB.prepare(`
    SELECT id,status FROM student_connection_requests
    WHERE sender_id=? AND recipient_id=? LIMIT 1
  `).bind(user.id,recipientId).first<{id:string;status:string}>();
  if(!request) return json({error:"The connection request could not be saved."},500);
  if(request.status==="pending"){
    await context.env.DB.prepare(`
      INSERT INTO student_notifications (id,user_id,dedupe_key,kind,title,message,destination,created_at)
      VALUES (?,?,?,'connection_request','New connection request','A ClerkMe student would like to connect with you.','you',unixepoch())
      ON CONFLICT(dedupe_key) DO UPDATE SET is_read=0,read_at=NULL,created_at=unixepoch()
    `).bind(crypto.randomUUID(),recipientId,"connection-request:"+request.id).run();
  }
  return json({status:request.status,requestId:request.id},201);
};
