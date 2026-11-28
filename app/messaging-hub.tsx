"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import DirectMessagesPanel from "./direct-messages";

type Audience = "everyone" | "conversations" | "only_me";
type Status = {
  id:string; userId:string; body:string; background:string; visibility:Audience;
  mediaKey?:string|null; mediaType?:string|null; mediaUrl?:string|null;
  createdAt:number; expiresAt:number; viewCount:number; hasViewed:boolean; allowReplies:boolean;
};
type StatusGroup = { userId:string; name:string; university?:string; statuses:Status[] };
type Preferences = { defaultAudience:Audience; hideViews:boolean; allowReplies:boolean };
type Profile = { id:string; name:string; email:string; university:string; country:string; level:string; futureSpecialty:string; state:string; lga:string; profilePhotoUrl?:string|null };
type ReplyLaunch = { conversationId:string; statusId:string; draft:string };

const backgrounds = ["#173765","#4C376D","#8A3F51","#23645E","#7A5B2C","#26374D"];
const initials = (name:string) => name.trim().split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase() || "CM";
const timeLabel = (stamp:number) => new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(new Date(stamp*1000));
const relativeAge = (stamp:number) => {
  const mins=Math.max(0,Math.floor(Date.now()/1000-stamp)/60);
  if(mins<1) return "Just now";
  if(mins<60) return Math.floor(mins)+"m ago";
  if(mins<1440) return Math.floor(mins/60)+"h ago";
  return "Yesterday";
};
const remaining = (expires:number) => {
  const mins=Math.max(0,Math.floor((expires-Date.now()/1000)/60));
  return mins>=60 ? Math.floor(mins/60)+"h left" : Math.max(1,mins)+"m left";
};
const decodeVapidKey = (value:string) => {
  const pad="=".repeat((4-value.length%4)%4);
  const decoded=atob((value+pad).replace(/-/g,"+").replace(/_/g,"/"));
  return Uint8Array.from(decoded,c=>c.charCodeAt(0));
};
const defaults:Preferences={defaultAudience:"everyone",hideViews:false,allowReplies:true};

export default function ClerkMeMessagingHub({userId}:{userId:string}) {
  const [section,setSection]=useState<"chats"|"connections"|"status"|"profile">("chats");
  const [replyLaunch,setReplyLaunch]=useState<ReplyLaunch|null>(null);
  const [hubNotice,setHubNotice]=useState("");
  const [incomingConnectionCount,setIncomingConnectionCount]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    const refresh=async()=>{
      try{
        const response=await fetch("/api/connections",{credentials:"same-origin",cache:"no-store"});
        if(!response.ok)return;
        const data=await response.json();
        if(!cancelled)setIncomingConnectionCount(Array.isArray(data.incoming)?data.incoming.length:0);
      }catch{/* Keep the last known badge count when temporarily offline. */}
    };
    void refresh();
    const interval=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh();},30000);
    document.addEventListener("visibilitychange",refresh);
    window.addEventListener("clerkme:connections-refresh",refresh);
    return()=>{cancelled=true;window.clearInterval(interval);document.removeEventListener("visibilitychange",refresh);window.removeEventListener("clerkme:connections-refresh",refresh);};
  },[userId]);
  const startReply=useCallback(async (status:Status,draft:string)=>{
    try{
      const response=await fetch("/api/messages",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({recipientId:status.userId})});
      const data=await response.json();
      if(!response.ok||!data.conversation?.id) throw new Error(data.error||"The conversation could not be opened.");
      setReplyLaunch({conversationId:data.conversation.id,statusId:status.id,draft});
      setHubNotice("");
      setSection("chats");
    }catch(error){setHubNotice(error instanceof Error?error.message:"The conversation could not be opened.");}
  },[]);
  return <section className="cmh-shell" aria-label="ClerkMe messaging">
    <header className="cmh-heading">
      <div><span className="cmh-eyebrow">CLERKME CONNECT</span><h1>Stay connected.</h1><p>Private conversations and everyday moments with your student community.</p></div>
      <img className="cmh-mark" src="/clerkme-mark-navy.svg" alt="" aria-hidden="true" width={56} height={56} decoding="async"/>
    </header>
    <nav className="cmh-tabs" aria-label="Messaging sections" role="tablist"
      onKeyDown={event=>{
        const order=["chats","connections","status","profile"] as const;
        const currentIndex=order.indexOf(section);
        const next=event.key==="ArrowRight"?(currentIndex+1)%order.length:event.key==="ArrowLeft"?(currentIndex+order.length-1)%order.length:event.key==="Home"?0:event.key==="End"?order.length-1:-1;
        if(next<0)return;
        event.preventDefault();
        setSection(order[next]);
        document.getElementById("cmh-tab-"+order[next])?.focus();
      }}>
      <button id="cmh-tab-chats" type="button" role="tab" aria-controls="cmh-panel-chats" aria-selected={section==="chats"} tabIndex={section==="chats"?0:-1} className={section==="chats"?"is-active":""} onClick={()=>setSection("chats")}><span className="cmh-tab-icon"><CmhIcon name="chat"/></span><span className="cmh-tab-label">Chats</span></button>
      <button id="cmh-tab-connections" type="button" role="tab" aria-controls="cmh-panel-connections" aria-selected={section==="connections"} tabIndex={section==="connections"?0:-1} className={section==="connections"?"is-active":""} onClick={()=>setSection("connections")}><span className="cmh-tab-icon"><CmhIcon name="connections"/>{incomingConnectionCount>0&&<span className="cmh-tab-count" aria-label={incomingConnectionCount+" pending connection requests"}>{incomingConnectionCount>9?"9+":incomingConnectionCount}</span>}</span><span className="cmh-tab-label">Connections</span></button>
      <button id="cmh-tab-status" type="button" role="tab" aria-controls="cmh-panel-status" aria-selected={section==="status"} tabIndex={section==="status"?0:-1} className={section==="status"?"is-active":""} onClick={()=>setSection("status")}><span className="cmh-tab-icon"><CmhIcon name="status"/></span><span className="cmh-tab-label">Status</span></button>
      <button id="cmh-tab-profile" type="button" role="tab" aria-controls="cmh-panel-profile" aria-selected={section==="profile"} tabIndex={section==="profile"?0:-1} className={section==="profile"?"is-active":""} onClick={()=>setSection("profile")}><span className="cmh-tab-icon"><CmhIcon name="user"/></span><span className="cmh-tab-label">Profile</span></button>
    </nav>
    {hubNotice&&<div className="cmh-alert" role="alert">{hubNotice}<button type="button" onClick={()=>setHubNotice("")} aria-label="Dismiss">×</button></div>}
    {section==="chats"&&<div id="cmh-panel-chats" className="cmh-tab-panel" role="tabpanel" aria-labelledby="cmh-tab-chats" tabIndex={0}><DirectMessagesPanel key={replyLaunch?.statusId||"clerkme-chats"} userId={userId} initialConversationId={replyLaunch?.conversationId||""} initialStatusReplyId={replyLaunch?.statusId||""} initialDraft={replyLaunch?.draft||""}/></div>}
        {section==="connections"&&<div id="cmh-panel-connections" className="cmh-tab-panel" role="tabpanel" aria-labelledby="cmh-tab-connections" tabIndex={0}><ConnectionsPanel onMessage={async student=>{
      try{
        const response=await fetch("/api/messages",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({recipientId:student.id})});
        const data=await response.json();
        if(!response.ok||!data.conversation?.id)throw new Error(data.error||"The conversation could not be opened.");
        setReplyLaunch({conversationId:data.conversation.id,statusId:"",draft:""});
        setHubNotice("");
        setSection("chats");
      }catch(error){setHubNotice(error instanceof Error?error.message:"The conversation could not be opened.");}
    }}/></div>}
{section==="status"&&<div id="cmh-panel-status" className="cmh-tab-panel" role="tabpanel" aria-labelledby="cmh-tab-status" tabIndex={0}><StatusPanel userId={userId} onReply={startReply}/></div>}
    {section==="profile"&&<div id="cmh-panel-profile" className="cmh-tab-panel" role="tabpanel" aria-labelledby="cmh-tab-profile" tabIndex={0}><MessagingProfilePanel/></div>}
  </section>;
}

function CmhIcon({name}:{name:"chat"|"spark"|"status"|"user"|"connections"|"eye"|"plus"|"clock"|"shield"|"bell"|"image"|"send"|"trash"|"chevron"|"search"|"upload"|"video"|"close"|"chevron-left"|"chevron-right"}) {
  const paths:Record<string,ReactNode>={
    chat:<><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 7.4 7.4 0 0 1-3.7-1L4 20l1.6-4.2a7.4 7.4 0 0 1-1.1-4.3A7.5 7.5 0 0 1 12 4h.5a7.5 7.5 0 0 1 7.5 7.5Z"/><path d="M8 11h8M8 14.5h5"/></>,
    spark:<><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
    status:<><path d="M19.3 8.2a8.5 8.5 0 1 1-3.5-3.6"/><path d="M19.5 3.8v4.8h-4.8"/><circle cx="12" cy="12" r="3.2"/></>,
    user:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    connections:<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M16 15a5 5 0 0 1 5 5"/></>,
    eye:<><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
    plus:<><path d="M12 5v14M5 12h14"/></>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    shield:<><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>,
    bell:<><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    image:<><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></>,
    send:<><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></>,
    trash:<><path d="M4 7h16M10 11v6M14 11v6"/><path d="m6 7 1 14h10l1-14M9 7V4h6v3"/></>,
    chevron:<path d="m9 18 6-6-6-6"/>,
    "chevron-left":<path d="m15 18-6-6 6-6"/>,
    "chevron-right":<path d="m9 18 6-6-6-6"/>,
    search:<><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    upload:<><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 19v1h16v-1"/></>,
    video:<><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></>,
    close:<path d="m6 6 12 12M18 6 6 18"/>
  };
  return <svg className="cmh-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

function StatusPanel({userId,onReply}:{userId:string;onReply:(status:Status,draft:string)=>void}) {
  const [groups,setGroups]=useState<StatusGroup[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [creating,setCreating]=useState(false);
  const [statusText,setStatusText]=useState("");
  const [background,setBackground]=useState(backgrounds[0]);
  const [audience,setAudience]=useState<Audience>("everyone");
  const [file,setFile]=useState<File|null>(null);
  const [saving,setSaving]=useState(false);
  const [viewerGroup,setViewerGroup]=useState<StatusGroup|null>(null);
  const [viewerIndex,setViewerIndex]=useState(0);
  const [replyText,setReplyText]=useState("");
  const [viewers,setViewers]=useState<Array<{id:string;name:string;university:string;viewedAt:number}>|null>(null);
  const [viewersLoading,setViewersLoading]=useState(false);
  const touchStartX=useRef<number|null>(null);

  const loadStatuses=useCallback(async()=>{
    setError("");
    try{
      const response=await fetch("/api/status",{credentials:"same-origin",cache:"no-store"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Statuses could not be loaded.");
      setGroups(Array.isArray(data.groups)?data.groups:[]);
    }catch(err){setError(err instanceof Error?err.message:"Statuses could not be loaded.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{
    void loadStatuses();
    const refresh=()=>{if(document.visibilityState==="visible") void loadStatuses();};
    document.addEventListener("visibilitychange",refresh);
    const interval=window.setInterval(refresh,45000);
    fetch("/api/status/preferences",{credentials:"same-origin",cache:"no-store"})
      .then(r=>r.ok?r.json():null).then(data=>{if(data?.defaultAudience) setAudience(data.defaultAudience as Audience);}).catch(()=>undefined);
    return()=>{document.removeEventListener("visibilitychange",refresh);window.clearInterval(interval);};
  },[loadStatuses]);

  const ownGroup=groups.find(group=>group.userId===userId);
  const otherGroups=groups.filter(group=>group.userId!==userId);
  const stories=useMemo(()=>viewerGroup?[...viewerGroup.statuses].sort((a,b)=>a.createdAt-b.createdAt):[],[viewerGroup]);
  const current=stories[viewerIndex]||null;

  useEffect(()=>{
    if(!creating&&!viewerGroup)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){
        event.preventDefault();
        if(viewerGroup)setViewerGroup(null);
        else setCreating(false);
      }else if(viewerGroup&&event.key==="ArrowRight"){
        event.preventDefault();
        setViewerIndex(index=>Math.min(stories.length-1,index+1));
      }else if(viewerGroup&&event.key==="ArrowLeft"){
        event.preventDefault();
        setViewerIndex(index=>Math.max(0,index-1));
      }
    };
    window.addEventListener("keydown",onKeyDown);
    return()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener("keydown",onKeyDown);
    };
  },[creating,viewerGroup,stories.length]);

  useEffect(()=>{
    if(!current||current.userId===userId) return;
    fetch("/api/status/"+encodeURIComponent(current.id)+"/view",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:"{}"})
      .then(response=>{if(!response.ok) return;setGroups(now=>now.map(group=>group.userId!==current.userId?group:{...group,statuses:group.statuses.map(status=>status.id===current.id?{...status,hasViewed:true}:status)}));})
      .catch(()=>undefined);
  },[current?.id,current?.userId,userId]);

  const openGroup=(group:StatusGroup)=>{
    const ordered=[...group.statuses].sort((a,b)=>a.createdAt-b.createdAt);
    const first=ordered.findIndex(status=>!status.hasViewed);
    setViewerGroup(group);
    setViewerIndex(first>=0&&group.userId!==userId?first:Math.max(0,ordered.length-1));
    setReplyText("");setViewers(null);
  };  const openStatus=(group:StatusGroup,statusId:string)=>{
    const ordered=[...group.statuses].sort((a,b)=>a.createdAt-b.createdAt);
    const selected=ordered.findIndex(status=>status.id===statusId);
    setViewerGroup(group);
    setViewerIndex(Math.max(0,selected));
    setReplyText("");setViewers(null);
  };
  const createStatus=async(event:FormEvent)=>{
    event.preventDefault();
    if(!statusText.trim()&&!file){setError("Add text, a photo or a short video before sharing.");return;}
    setSaving(true);setError("");
    try{
      let mediaKey:string|undefined;
      if(file){
        const form=new FormData();form.append("file",file);
        const upload=await fetch("/api/status/media",{method:"POST",credentials:"same-origin",body:form});
        const uploaded=await upload.json();
        if(!upload.ok) throw new Error(uploaded.error||"Your media could not be uploaded.");
        mediaKey=uploaded.mediaKey;
      }
      const response=await fetch("/api/status",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:statusText.trim(),background,visibility:audience,mediaKey})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Your status could not be shared.");
      setCreating(false);setStatusText("");setFile(null);await loadStatuses();
    }catch(err){setError(err instanceof Error?err.message:"Your status could not be shared.");}
    finally{setSaving(false);}
  };
  const deleteStatus=async(status:Status)=>{
    if(!window.confirm("Delete this status?")) return;
    try{
      const response=await fetch("/api/status/"+encodeURIComponent(status.id),{method:"DELETE",credentials:"same-origin"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"The status could not be deleted.");
      setViewerGroup(null);await loadStatuses();
    }catch(err){setError(err instanceof Error?err.message:"The status could not be deleted.");}
  };
  const loadViewers=async(status:Status)=>{
    setViewersLoading(true);setViewers(null);
    try{
      const response=await fetch("/api/status/"+encodeURIComponent(status.id)+"/viewers",{credentials:"same-origin"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Viewers could not be loaded.");
      setViewers(data.viewers||[]);
    }catch(err){setError(err instanceof Error?err.message:"Viewers could not be loaded.");}
    finally{setViewersLoading(false);}
  };
  const sendReply=()=>{
    if(!current||!replyText.trim()||!current.allowReplies) return;
    const status=current,draft=replyText.trim().slice(0,4000);
    setViewerGroup(null);onReply(status,draft);
  };
  return <section className="cmh-status" aria-label="Status updates">
    <div className="cmh-section-heading"><div><span className="cmh-eyebrow">24-HOUR MOMENTS</span><h2>Status</h2><p>Share a little moment with your ClerkMe community.</p></div><button className="cmh-primary" type="button" onClick={()=>setCreating(true)}><CmhIcon name="plus"/>Add status</button></div>
    {error&&<div className="cmh-alert" role="alert"><span>{error}</span><button type="button" onClick={()=>setError("")} aria-label="Dismiss">×</button></div>}
    <div className="cmh-status-tray">
      <button type="button" className="cmh-story-person" onClick={()=>ownGroup?openGroup(ownGroup):setCreating(true)}>
        <span className="cmh-story-ring cmh-story-add"><b><CmhIcon name="plus"/></b></span><strong>My status</strong><small>{ownGroup?ownGroup.statuses.length+" updates":"Share an update"}</small>
      </button>
      {otherGroups.map(group=>{
        const unseen=group.statuses.some(status=>!status.hasViewed);
        return <button type="button" className="cmh-story-person" key={group.userId} onClick={()=>openGroup(group)}>
          <span className={"cmh-story-ring "+(unseen?"has-unseen":"is-seen")}><b>{initials(group.name)}</b></span>
          <strong>{group.name.split(" ")[0]}</strong><small>{group.statuses.length} update{group.statuses.length===1?"":"s"}</small>
        </button>;
      })}
    </div>
    <div className="cmh-status-feed">
      <div className="cmh-feed-heading"><h3>Your updates</h3><span><CmhIcon name="clock"/> Disappear after 24 hours</span></div>
      {loading?<div className="cmh-status-loading" role="status"><i/><i/><i/><span>Loading statuses…</span></div>:
        !ownGroup||ownGroup.statuses.length===0?<div className="cmh-empty-status"><span className="cmh-empty-mark"><CmhIcon name="spark"/></span><strong>Your story starts here.</strong><p>Post a thought, a photo or a short video. Your update will be available for 24 hours.</p><button type="button" className="cmh-secondary" onClick={()=>setCreating(true)}>Create your first status</button></div>:
        <div className="cmh-status-cards">{ownGroup.statuses.map(status=><button type="button" key={status.id} className="cmh-status-card" onClick={()=>openStatus(ownGroup,status.id)}>
          {status.mediaUrl&&status.mediaType?.startsWith("image/")?<img src={status.mediaUrl} alt="" loading="lazy"/>:
            status.mediaUrl&&status.mediaType?.startsWith("video/")?<span className="cmh-video-thumb"><b>▶</b> Video update</span>:
            <span className="cmh-status-text-thumb" style={{background:status.background}}>{status.body}</span>}
          <span className="cmh-status-card-meta"><b><CmhIcon name="eye"/>{status.viewCount}</b><small>{remaining(status.expiresAt)}</small></span>
        </button>)}</div>}
      {otherGroups.length>0&&<div className="cmh-feed-heading cmh-other-heading"><h3>Recent updates</h3><span>{otherGroups.length} student{otherGroups.length===1?"":"s"}</span></div>}
      {!loading&&otherGroups.length===0&&!error&&<p className="cmh-muted">When students you can view post a status, it will appear here.</p>}
    </div>

    {creating&&<div className="cmh-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setCreating(false);}}>
      <section className="cmh-create-modal" role="dialog" aria-modal="true" aria-labelledby="cmh-create-title">
        <button type="button" className="cmh-close" onClick={()=>setCreating(false)} aria-label="Close"><CmhIcon name="close"/></button>
        <span className="cmh-eyebrow">YOUR NEXT 24 HOURS</span><h2 id="cmh-create-title">Create a status</h2>
        <form onSubmit={createStatus}>
          <label className="cmh-status-caption">What would you like to share?
            <textarea value={statusText} onChange={event=>setStatusText(event.target.value)} maxLength={500} rows={4} placeholder="A thought, a win, a little moment…"/>
            <small>{statusText.length}/500 characters</small>
          </label>
          <div className="cmh-background-picker"><span>Text background</span>{backgrounds.map(color=><button type="button" key={color} style={{background:color}} aria-label={"Choose "+color} aria-pressed={background===color} onClick={()=>setBackground(color)}/>)}</div>
          <div className="cmh-file-picker">
            <input id="cmh-status-file" key={file?.name||"empty"} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={event=>{
              const selected=event.target.files?.[0]||null;
              if(!selected){setFile(null);return;}
              const video=selected.type.startsWith("video/");
              const limit=video?25*1024*1024:8*1024*1024;
              if(selected.size>limit){setFile(null);setError(video?"Choose a video of 25 MB or less.":"Choose an image of 8 MB or less.");event.currentTarget.value="";return;}
              setError("");setFile(selected);
            }}/>
            <label htmlFor="cmh-status-file" className="cmh-file-picker-label">
              <span className="cmh-file-icon"><CmhIcon name={file?.type.startsWith("video/")?"video":"upload"}/></span>
              <span className="cmh-file-copy"><b>{file?"Media selected":"Add a photo or short video"}</b><small>{file?file.name+" · "+(file.size/1024/1024).toFixed(1)+" MB":"Photos up to 8 MB · videos up to 25 MB"}</small></span>
              <span className="cmh-file-browse">Browse</span>
            </label>
          </div>
          {file&&<div className="cmh-selected-file"><CmhIcon name="image"/><span>{file.name}</span><button type="button" onClick={()=>setFile(null)}>Remove</button></div>}
          <label className="cmh-audience">Who can see this status?
            <select value={audience} onChange={event=>setAudience(event.target.value as Audience)}>
              <option value="everyone">All verified students</option><option value="conversations">Students I have chatted with</option><option value="only_me">Only me</option>
            </select>
          </label>
          <button type="submit" className="cmh-primary cmh-share-status" disabled={saving}>{saving?"Sharing…":"Share status"}</button>
        </form>
      </section>
    </div>}

    {current&&viewerGroup&&<div className="cmh-story-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setViewerGroup(null);}}>
      <section className="cmh-story-viewer" role="dialog" aria-modal="true" aria-label={viewerGroup.name+"'s status"}>
        <div className="cmh-story-progress" aria-label={"Status "+(viewerIndex+1)+" of "+stories.length}>{stories.map((story,index)=><span key={story.id} className={index<=viewerIndex?"is-filled":""}/>)}</div>
        <header className="cmh-story-header"><span className="cmh-story-avatar">{initials(viewerGroup.name)}</span><div><strong>{viewerGroup.name}</strong><small>{relativeAge(current.createdAt)} · {remaining(current.expiresAt)}</small></div><button type="button" onClick={()=>setViewerGroup(null)} aria-label="Close status"><CmhIcon name="close"/></button></header>
        <div className="cmh-story-stage" onTouchStart={event=>{touchStartX.current=event.changedTouches[0]?.clientX??null;}} onTouchEnd={event=>{const start=touchStartX.current;touchStartX.current=null;if(start===null)return;const end=event.changedTouches[0]?.clientX??start;const delta=end-start;if(Math.abs(delta)>48)setViewerIndex(index=>Math.max(0,Math.min(stories.length-1,index+(delta<0?1:-1))));}}>
          {current.mediaUrl&&current.mediaType?.startsWith("image/")?<img src={current.mediaUrl} alt={"Status from "+viewerGroup.name}/>:
            current.mediaUrl&&current.mediaType?.startsWith("video/")?<video src={current.mediaUrl} controls autoPlay playsInline/>:
            <div className="cmh-story-text" style={{background:current.background}}>{current.body}</div>}
          {current.body&&current.mediaUrl&&<p className="cmh-story-caption">{current.body}</p>}
          <button type="button" className="cmh-story-nav cmh-story-prev" onClick={()=>setViewerIndex(index=>Math.max(0,index-1))} disabled={viewerIndex===0} aria-label="Previous status"><CmhIcon name="chevron-left"/></button>
          <button type="button" className="cmh-story-nav cmh-story-next" onClick={()=>setViewerIndex(index=>Math.min(stories.length-1,index+1))} disabled={viewerIndex>=stories.length-1} aria-label="Next status"><CmhIcon name="chevron-right"/></button>
        </div>
        <footer className="cmh-story-footer">
          {viewerGroup.userId===userId?<><button type="button" className="cmh-viewers-btn" onClick={()=>void loadViewers(current)}><CmhIcon name="eye"/>{current.viewCount} viewers</button><button type="button" className="cmh-delete-status" onClick={()=>void deleteStatus(current)}><CmhIcon name="trash"/>Delete</button></>:
            current.allowReplies?<><input value={replyText} onChange={event=>setReplyText(event.target.value)} placeholder="Reply privately…" maxLength={4000} aria-label="Reply to this status"/><button type="button" onClick={sendReply} disabled={!replyText.trim()}><CmhIcon name="send"/>Reply</button></>:
            <span>Replies are turned off for this status.</span>}
        </footer>
        {viewers!==null&&<div className="cmh-viewers-panel"><strong>Viewed by</strong>{viewers.length===0?<p>No visible viewers yet.</p>:viewers.map(viewer=><div key={viewer.id}><span>{initials(viewer.name)}</span><label><b>{viewer.name}</b><small>{viewer.university}</small></label><time>{timeLabel(viewer.viewedAt)}</time></div>)}</div>}
        {viewersLoading&&<div className="cmh-viewers-loading">Loading viewers…</div>}
      </section>
    </div>}
  </section>;
}

type ConnectionStudent = {
  connectionId:string; status:"pending"|"accepted"; requestedBy:string; createdAt:number;
  updatedAt:number; otherId:string; name:string; university:string; level:string;
  lastSeenAt:number|null; profilePhotoUrl:string|null;
};

function ConnectionsPanel({onMessage}:{onMessage:(student:{id:string;name:string;university?:string;level?:string;lastSeenAt?:number|null;profilePhotoUrl?:string|null;connectionStatus:"accepted"})=>void}) {
  const [incoming,setIncoming]=useState<ConnectionStudent[]>([]);
  const [outgoing,setOutgoing]=useState<ConnectionStudent[]>([]);
  const [accepted,setAccepted]=useState<ConnectionStudent[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    try{
      const response=await fetch("/api/connections",{credentials:"same-origin",cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Connections could not be loaded.");
      setIncoming(Array.isArray(data.incoming)?data.incoming:[]);
      setOutgoing(Array.isArray(data.outgoing)?data.outgoing:[]);
      setAccepted(Array.isArray(data.accepted)?data.accepted:[]);
    }catch(error){setNotice(error instanceof Error?error.message:"Connections could not be loaded.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{
    void load();
    const interval=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},30000);
    const refresh=()=>void load();
    window.addEventListener("clerkme:connections-refresh",refresh);
    document.addEventListener("visibilitychange",refresh);
    return()=>{window.clearInterval(interval);window.removeEventListener("clerkme:connections-refresh",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[load]);

  const updateRequest=async(item:ConnectionStudent,action:"accept"|"decline"|"cancel")=>{
    setBusy(item.connectionId);setNotice("");
    try{
      const response=await fetch("/api/connections/"+encodeURIComponent(item.connectionId),{
        method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"The connection request could not be updated.");
      window.dispatchEvent(new Event("clerkme:connections-refresh"));
      setNotice(action==="accept"?"Connection accepted. You can now message each other.":action==="decline"?"Connection request declined.":"Connection request cancelled.");
      await load();
    }catch(error){setNotice(error instanceof Error?error.message:"The connection request could not be updated.");}
    finally{setBusy("");}
  };
  const removeConnection=async(item:ConnectionStudent)=>{
    if(!window.confirm("Remove "+item.name+" from your connections? Private messaging will be disabled for both of you."))return;
    setBusy(item.connectionId);setNotice("");
    try{
      const response=await fetch("/api/connections/"+encodeURIComponent(item.connectionId),{method:"DELETE",credentials:"same-origin"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"The connection could not be removed.");
      window.dispatchEvent(new Event("clerkme:connections-refresh"));
      setNotice("Connection removed. Private messaging is now closed.");
      await load();
    }catch(error){setNotice(error instanceof Error?error.message:"The connection could not be removed.");}
    finally{setBusy("");}
  };
  const avatar=(item:ConnectionStudent)=><span className="cmh-connection-avatar">{item.profilePhotoUrl?<img src={item.profilePhotoUrl} alt="" loading="lazy"/>:initials(item.name)}</span>;
  const card=(item:ConnectionStudent,kind:"incoming"|"outgoing"|"accepted")=><article className="cmh-connection-card" key={item.connectionId}>
    {avatar(item)}
    <div className="cmh-connection-copy"><strong>{item.name}</strong><small>{[item.university,item.level].filter(Boolean).join(" · ")||"ClerkMe student"}</small>
      <span>{kind==="incoming"?"Wants to connect with you":kind==="outgoing"?"Waiting for your request to be accepted":"Connected on ClerkMe"}</span>
    </div>
    <div className="cmh-connection-actions">
      {kind==="incoming"?<>
        <button type="button" className="cmh-primary" disabled={Boolean(busy)} onClick={()=>void updateRequest(item,"accept")}>{busy===item.connectionId?"Saving…":"Accept"}</button>
        <button type="button" className="cmh-secondary" disabled={Boolean(busy)} onClick={()=>void updateRequest(item,"decline")}>Decline</button>
      </>:kind==="outgoing"?<>
        <span className="cmh-pending-label">Request sent</span>
        <button type="button" className="cmh-secondary" disabled={Boolean(busy)} onClick={()=>void updateRequest(item,"cancel")}>Cancel</button>
      </>:<>
        <button type="button" className="cmh-primary" onClick={()=>onMessage({id:item.otherId,name:item.name,university:item.university,level:item.level,lastSeenAt:item.lastSeenAt,profilePhotoUrl:item.profilePhotoUrl,connectionStatus:"accepted"})}>Message</button>
        <button type="button" className="cmh-secondary" disabled={Boolean(busy)} onClick={()=>void removeConnection(item)}>{busy===item.connectionId?"Removing…":"Remove"}</button>
      </>}
    </div>
  </article>;

  if(loading)return <div className="cmh-profile-loading" role="status"><i/>Loading your connections…</div>;
  return <section className="cmh-connections" aria-label="Your student connections">
    {notice&&<div className="cmh-alert" role="status"><span>{notice}</span><button type="button" onClick={()=>setNotice("")} aria-label="Dismiss">×</button></div>}
    <div className="cmh-connections-heading"><div><span className="cmh-eyebrow">YOUR NETWORK</span><h2>Connections</h2><p>Accept a request before either student can start a private conversation.</p></div><span className="cmh-connections-count">{accepted.length} connected</span></div>
    <section className="cmh-connection-group"><div className="cmh-connection-group-heading"><h3>Requests to you</h3><span>{incoming.length}</span></div>
      {incoming.length?incoming.map(item=>card(item,"incoming")):<p className="cmh-connection-empty">No new requests. Incoming requests will appear here.</p>}
    </section>
    <section className="cmh-connection-group"><div className="cmh-connection-group-heading"><h3>Requests you sent</h3><span>{outgoing.length}</span></div>
      {outgoing.length?outgoing.map(item=>card(item,"outgoing")):<p className="cmh-connection-empty">You have no pending requests.</p>}
    </section>
    <section className="cmh-connection-group"><div className="cmh-connection-group-heading"><h3>Your connections</h3><span>{accepted.length}</span></div>
      {accepted.length?accepted.map(item=>card(item,"accepted")):<p className="cmh-connection-empty">No connections yet. Find a student in Chats and send a request.</p>}
    </section>
    <p className="cmh-connection-privacy"><CmhIcon name="shield"/> Private messages are available only between accepted connections. You can remove a connection at any time.</p>
  </section>;
}

function MessagingProfilePanel() {
  const [profile,setProfile]=useState<Profile|null>(null);
  const [preferences,setPreferences]=useState<Preferences>(defaults);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [pushEnabled,setPushEnabled]=useState(false);
  const [permission,setPermission]=useState<NotificationPermission|"unsupported">("default");
  const [pushBusy,setPushBusy]=useState(false);
  const [testBusy,setTestBusy]=useState(false);
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    let cancelled=false;
    Promise.all([
      fetch("/api/profile",{credentials:"same-origin",cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Profile could not be loaded.");return d.profile as Profile;}),
      fetch("/api/status/preferences",{credentials:"same-origin",cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Privacy settings could not be loaded.");return d as Preferences;})
    ]).then(([p,prefs])=>{if(!cancelled){setProfile(p);setPreferences(prefs);}})
      .catch(error=>{if(!cancelled)setNotice(error instanceof Error?error.message:"Profile could not be loaded.");})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[]);
  useEffect(()=>{
    if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window)){setPermission("unsupported");return;}
    setPermission(Notification.permission);
    navigator.serviceWorker.getRegistration().then(async registration=>{
      const subscription=await registration?.pushManager.getSubscription();
      setPushEnabled(Boolean(subscription));
    }).catch(()=>setPushEnabled(false));
  },[]);

  const savePreferences=async(patch:Partial<Preferences>)=>{
    const previous=preferences,next={...preferences,...patch};
    setPreferences(next);setSaving(true);setNotice("");
    try{
      const response=await fetch("/api/status/preferences",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(next)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Privacy settings could not be saved.");setPreferences(data);
    }catch(error){setPreferences(previous);setNotice(error instanceof Error?error.message:"Privacy settings could not be saved.");}
    finally{setSaving(false);}
  };
  const togglePush=async()=>{
    setPushBusy(true);setNotice("");
    try{
      if(pushEnabled){
        const registration=await navigator.serviceWorker.getRegistration();
        const subscription=await registration?.pushManager.getSubscription();
        if(subscription){
          const response=await fetch("/api/push/subscriptions",{method:"DELETE",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({endpoint:subscription.endpoint})});
          const data=await response.json();if(!response.ok)throw new Error(data.error||"The notification subscription could not be removed.");
          await subscription.unsubscribe();
        }
        setPushEnabled(false);setNotice("Phone message notifications are off on this device.");
      }else{
        if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error("This browser does not support background notifications. Install ClerkMe as an app or use a supported browser.");
        const granted=await Notification.requestPermission();setPermission(granted);
        if(granted!=="granted")throw new Error(granted==="denied"?"Notifications are blocked in your device or browser settings. Allow them for ClerkMe, then try again.":"Notification permission was not granted.");
        const keyResponse=await fetch("/api/push/config",{credentials:"same-origin",cache:"no-store"});
        const keyData=await keyResponse.json();
        if(!keyResponse.ok||typeof keyData.publicKey!=="string"||!keyData.publicKey)throw new Error(keyData.error||"Phone notifications are not configured yet.");
        await navigator.serviceWorker.register("/sw.js",{scope:"/"});
        const registration=await navigator.serviceWorker.ready;
        const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidKey(keyData.publicKey)});
        const response=await fetch("/api/push/subscriptions",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(subscription.toJSON())});
        const data=await response.json();if(!response.ok)throw new Error(data.error||"Your device could not be registered for notifications.");
        setPushEnabled(true);setNotice("Phone message notifications are enabled on this device.");
      }
    }catch(error){setNotice(error instanceof Error?error.message:"Notification settings could not be updated.");}
    finally{setPushBusy(false);}
  };
  const sendTestNotification=async()=>{
    setTestBusy(true);setNotice("");
    try{
      const response=await fetch("/api/push/test",{method:"POST",credentials:"same-origin",headers:{"Accept":"application/json"}});
      const data=await response.json();
      if(!response.ok||!data.sent)throw new Error(data.error||"The test alert could not be delivered to this device.");
      setNotice("Test alert sent. Check your phone's notification tray.");
    }catch(error){setNotice(error instanceof Error?error.message:"The test alert could not be sent.");}
    finally{setTestBusy(false);}
  };
  if(loading)return <div className="cmh-profile-loading" role="status"><i/>Loading your profile…</div>;
  return <section className="cmh-profile" aria-label="Messaging profile and privacy">
    {notice&&<div className="cmh-alert" role="status"><span>{notice}</span><button type="button" onClick={()=>setNotice("")} aria-label="Dismiss">×</button></div>}
    <div className="cmh-profile-card">
      <div className="cmh-profile-avatar">{profile?.profilePhotoUrl?<img src={profile.profilePhotoUrl} alt="" loading="lazy"/>:initials(profile?.name||"Student")}</div>
      <div className="cmh-profile-details">
        <span className="cmh-eyebrow">YOUR PROFILE</span>
        <h2>{profile?.name||"Student"}</h2>
        <p>{profile?.email}</p>
        <small>{[profile?.university,profile?.level].filter(Boolean).join(" · ")}</small>
      </div>
      <button type="button" className="cmh-secondary cmh-edit-profile" onClick={()=>window.dispatchEvent(new CustomEvent("clerkme:navigate",{detail:{section:"you"}}))}>Edit profile</button>
    </div>

    <details className="cmh-settings-card cmh-profile-privacy">
      <summary className="cmh-privacy-summary">
        <span className="cmh-privacy-summary-copy"><span>PRIVACY</span><b>Privacy & status</b><small>Manage your audience, views and replies</small></span>
        <span className="cmh-privacy-chevron" aria-hidden="true"><CmhIcon name="chevron"/></span>
      </summary>
      <div className="cmh-profile-privacy-content">
        <div className="cmh-settings-heading"><h3>Your status, your choice.</h3><p>Choose who sees your updates and what activity is visible.</p></div>
        <label className="cmh-setting-row"><span><b>Default status audience</b><small>Who can view new statuses you share</small></span>
          <select value={preferences.defaultAudience} disabled={saving} onChange={event=>void savePreferences({defaultAudience:event.target.value as Audience})}><option value="everyone">All verified students</option><option value="conversations">Students I have chatted with</option><option value="only_me">Only me</option></select>
        </label>
        <label className="cmh-setting-row"><span><b>Hide my status views</b><small>Your name will not appear in other students' viewer lists</small></span><input type="checkbox" checked={preferences.hideViews} disabled={saving} onChange={event=>void savePreferences({hideViews:event.target.checked})}/></label>
        <label className="cmh-setting-row"><span><b>Allow replies to my statuses</b><small>Replies open a private one-to-one conversation</small></span><input type="checkbox" checked={preferences.allowReplies} disabled={saving} onChange={event=>void savePreferences({allowReplies:event.target.checked})}/></label>
        {saving&&<small className="cmh-saving">Saving privacy settings…</small>}
      </div>
    </details>

    <div className="cmh-settings-card cmh-notification-card">
      <div className="cmh-settings-heading"><span>PHONE ALERTS</span><h3>Message notifications</h3><p>Get a phone notification when another student messages you, even when ClerkMe is in the background.</p></div>
      <div className="cmh-notification-actions">
        <div className="cmh-notification-state">
          <span className={"cmh-notification-dot"+(pushEnabled?" is-on":"")}/>
          <span><b>{pushEnabled?"Notifications enabled":"Notifications not enabled"}</b><small>{permission==="unsupported"?"This browser does not support push notifications.":permission==="denied"?"Blocked by your device or browser settings.":pushEnabled?"This device is registered for private-message alerts.":"Allow notifications so ClerkMe can alert you about new messages."}</small></span>
        </div>
        <button type="button" className={pushEnabled?"cmh-secondary":"cmh-primary"} onClick={()=>void togglePush()} disabled={pushBusy||permission==="unsupported"||(permission==="denied"&&!pushEnabled)}>{pushBusy?"Updating…":pushEnabled?"Turn off":"Enable alerts"}</button>
      </div>
      {pushEnabled&&<button type="button" className="cmh-test-notification" onClick={()=>void sendTestNotification()} disabled={testBusy}>{testBusy?"Sending test…":"Send test notification"}</button>}
      <p className="cmh-privacy-note">Alerts do not include the message text. You can change notification permission in your device settings.</p>
    </div>
    <div className="cmh-security-note"><CmhIcon name="shield"/><p><b>Private to conversation participants.</b> Messages are protected in transit but are not currently end-to-end encrypted.</p></div>
  </section>;
}
