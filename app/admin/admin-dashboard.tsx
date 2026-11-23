"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ClerkMeBrand from "../../components/clerkme-brand";

type Metrics = {
  totalUsers:number; newUsers7d:number; activeToday:number; totalCases:number;
  totalMaterials:number; totalVideos:number; activeGenerationJobs:number; failedGenerationJobs7d:number;
};
type Activity = { day:string; activeUsers:number };
type AuditEvent = { id:string; action:string; createdAt:string; userName:string; userEmail:string };
type Overview = {
  admin:{name:string;email:string}; metrics:Metrics; activity:Activity[];
  jobs:{status:string;total:number}[]; events:AuditEvent[];
  services:Record<string,boolean>;
  metering:{aiTokenUsage:string;aiSpend:string;note:string};
};
type Student = {
  id:string; name:string; email:string; university:string; level:string; createdAt:number;
  lastActive:string|null; caseCount:number; materialCount:number; videoCount:number;
};
type Directory = { users:Student[]; page:number; perPage:number; total:number; totalPages:number };

const numberFormat=new Intl.NumberFormat("en-NG");
const serviceLabels:Record<string,string>={
  database:"D1 database",googleSignIn:"Google sign-in",workersAI:"Cloudflare Workers AI",
  geminiAPI:"Gemini API",zaiAPI:"Z.AI provider",youtubeDataAPI:"YouTube Data API",
  sourceFileStorage:"Original-file storage"
};
const prettyAction=(value:string)=>value.replace(/[._-]+/g," ").replace(/\b\w/g,letter=>letter.toUpperCase());
const dateLabel=(value:string|null)=>{
  if(!value)return "No activity yet";
  const date=new Date(value+"T00:00:00+01:00");
  return Number.isNaN(date.getTime())?value:date.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
};
const timeLabel=(value:string|number)=>{
  const date=typeof value==="number"?new Date(value*1000):new Date(value.replace(" ","T")+"Z");
  return Number.isNaN(date.getTime())?"—":date.toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
};
const firstName=(name:string)=>name.trim().split(/\s+/)[0]||"Administrator";

export default function AdminDashboard(){
  const [access,setAccess]=useState<"loading"|"allowed"|"unauthenticated"|"forbidden"|"error">("loading");
  const [overview,setOverview]=useState<Overview|null>(null);
  const [tab,setTab]=useState<"overview"|"students">("overview");
  const [refreshing,setRefreshing]=useState(false);
  const [search,setSearch]=useState("");
  const [appliedSearch,setAppliedSearch]=useState("");
  const [page,setPage]=useState(1);
  const [directory,setDirectory]=useState<Directory|null>(null);
  const [directoryLoading,setDirectoryLoading]=useState(false);
  const [error,setError]=useState("");
  const [directoryError,setDirectoryError]=useState("");

  const loadOverview=useCallback(async()=>{
    const response=await fetch("/api/admin/overview",{credentials:"same-origin",cache:"no-store"});
    if(response.status===401){setAccess("unauthenticated");return;}
    if(response.status===403){setAccess("forbidden");return;}
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"The admin overview could not be loaded.");
    setOverview(data as Overview);
    setAccess("allowed");
  },[]);

  const loadDirectory=useCallback(async(query:string,currentPage:number)=>{
    setDirectoryLoading(true);
    setDirectoryError("");
    try{
      const params=new URLSearchParams({q:query,page:String(currentPage),perPage:"20"});
      const response=await fetch("/api/admin/users?"+params.toString(),{credentials:"same-origin",cache:"no-store"});
      if(response.status===401){setAccess("unauthenticated");return;}
      if(response.status===403){setAccess("forbidden");return;}
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"The student directory could not be loaded.");
      setDirectory(data as Directory);
    }catch(reason){
      setDirectoryError(reason instanceof Error?reason.message:"The student directory could not be loaded.");
    }finally{
      setDirectoryLoading(false);
    }
  },[]);

  useEffect(()=>{
    loadOverview().catch(reason=>{
      setError(reason instanceof Error?reason.message:"The admin console could not be loaded.");
      setAccess("error");
    });
  },[loadOverview]);

  useEffect(()=>{
    if(access==="allowed"&&tab==="students")void loadDirectory(appliedSearch,page);
  },[access,tab,appliedSearch,page,loadDirectory]);

  const refresh=async()=>{
    setRefreshing(true);setError("");
    try{
      await loadOverview();
      if(tab==="students")await loadDirectory(appliedSearch,page);
    }catch(reason){
      setError(reason instanceof Error?reason.message:"Refresh failed.");
    }finally{
      setRefreshing(false);
    }
  };
  const submitSearch=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setPage(1);setAppliedSearch(search.trim());
  };
  const activityMax=useMemo(()=>Math.max(1,...(overview?.activity||[]).map(item=>item.activeUsers)),[overview]);
  const metrics=overview?.metrics;

  if(access==="loading")return <main className="admin-gate"><div className="admin-gate-card"><ClerkMeBrand caption="PLATFORM CONTROL" className="admin-gate-brand"/><span className="admin-loading-mark"/><h1>Securing your admin session</h1><p>Checking your ClerkME permissions.</p></div></main>;
  if(access==="unauthenticated")return <main className="admin-gate"><div className="admin-gate-card"><ClerkMeBrand caption="PLATFORM CONTROL" className="admin-gate-brand"/><span className="admin-gate-symbol">↗</span><h1>Sign in to continue</h1><p>The admin console requires an authenticated ClerkME account.</p><a className="admin-primary-link" href="/login">Sign in to ClerkME</a><a className="admin-back-link" href="/">Return to ClerkME</a></div></main>;
  if(access==="forbidden")return <main className="admin-gate"><div className="admin-gate-card"><ClerkMeBrand caption="PRIVATE ADMIN AREA" className="admin-gate-brand"/><span className="admin-gate-symbol is-restricted">⌁</span><h1>Admin access is not enabled</h1><p>This Google account is not on ClerkME’s server-side administrator allow-list. Add its exact sign-in email to the <strong>CLERKME_ADMIN_EMAILS</strong> Cloudflare Pages environment variable.</p><a className="admin-back-link" href="/">Return to ClerkME</a></div></main>;
  if(access==="error")return <main className="admin-gate"><div className="admin-gate-card"><ClerkMeBrand caption="PLATFORM CONTROL" className="admin-gate-brand"/><span className="admin-gate-symbol is-restricted">!</span><h1>Admin console unavailable</h1><p>{error||"The dashboard could not be loaded."}</p><button className="admin-primary-button" type="button" onClick={()=>{setAccess("loading");loadOverview().catch(reason=>{setError(reason instanceof Error?reason.message:"Please retry.");setAccess("error");});}}>Try again</button><a className="admin-back-link" href="/">Return to ClerkME</a></div></main>;

  return <main className="admin-page">
    <header className="admin-topbar">
      <ClerkMeBrand caption="PLATFORM CONTROL" className="admin-brand"/>
      <div className="admin-topbar-right">
        <span className="admin-secure-indicator"><i/> Private admin console</span>
        <span className="admin-admin-avatar">{overview?.admin.name.trim()[0]?.toUpperCase()||"A"}</span>
        <span className="admin-admin-identity"><strong>{overview?.admin.name||"Administrator"}</strong><small>{overview?.admin.email}</small></span>
        <a className="admin-workspace-link" href="/">Back to workspace <span>↗</span></a>
      </div>
    </header>
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <span className="admin-nav-heading">ADMINISTRATION</span>
        <button type="button" className={tab==="overview"?"admin-nav-item is-active":"admin-nav-item"} onClick={()=>setTab("overview")}><span>▦</span> Overview</button>
        <button type="button" className={tab==="students"?"admin-nav-item is-active":"admin-nav-item"} onClick={()=>setTab("students")}><span>♙</span> Students <small>{numberFormat.format(metrics?.totalUsers||0)}</small></button>
        <div className="admin-sidebar-note"><span className="admin-sidebar-note-icon">✦</span><strong>ClerkME operations</strong><p>Monitor platform adoption, learning activity and connected services from one private workspace.</p></div>
        <div className="admin-sidebar-footer"><span className="admin-live-dot"/> Live data from ClerkME D1</div>
      </aside>
      <section className="admin-content">
        <div className="admin-content-toolbar">
          <div className="admin-breadcrumb">ClerkME <span>/</span> <strong>{tab==="overview"?"Overview":"Student directory"}</strong></div>
          <button type="button" className="admin-refresh-button" onClick={refresh} disabled={refreshing}><span className={refreshing?"admin-refresh-icon is-spinning":"admin-refresh-icon"}>↻</span>{refreshing?"Refreshing…":"Refresh data"}</button>
        </div>
        {error&&<div className="admin-inline-error" role="alert">{error}</div>}
        {tab==="overview"&&metrics&&<>
          <div className="admin-page-heading">
            <div><span className="admin-eyebrow">CLERKME / OWNER OVERVIEW</span><h1>Welcome, {firstName(overview?.admin.name||"")}.</h1><p>Your platform at a glance. Review student growth, activity and service readiness.</p></div>
            <span className="admin-date-pill">{new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</span>
          </div>
          <div className="admin-metric-grid">
            <article className="admin-metric-card"><span className="admin-metric-icon navy">♙</span><div><small>REGISTERED STUDENTS</small><strong>{numberFormat.format(metrics.totalUsers)}</strong><span className="admin-metric-foot">All ClerkME accounts</span></div></article>
            <article className="admin-metric-card"><span className="admin-metric-icon blue">↗</span><div><small>NEW THIS WEEK</small><strong>{numberFormat.format(metrics.newUsers7d)}</strong><span className="admin-metric-foot">Accounts created in 7 days</span></div></article>
            <article className="admin-metric-card"><span className="admin-metric-icon teal">◉</span><div><small>ACTIVE TODAY</small><strong>{numberFormat.format(metrics.activeToday)}</strong><span className="admin-metric-foot">Students with a study day today</span></div></article>
            <article className="admin-metric-card"><span className="admin-metric-icon violet">▤</span><div><small>CLINICAL CASES</small><strong>{numberFormat.format(metrics.totalCases)}</strong><span className="admin-metric-foot">Non-deleted case records</span></div></article>
          </div>
          <div className="admin-secondary-metrics">
            <div><span className="admin-secondary-icon">▧</span><span><strong>{numberFormat.format(metrics.totalMaterials)}</strong><small>Study materials uploaded</small></span></div>
            <div><span className="admin-secondary-icon">▶</span><span><strong>{numberFormat.format(metrics.totalVideos)}</strong><small>Saved YouTube videos</small></span></div>
            <div><span className="admin-secondary-icon">✦</span><span><strong>{numberFormat.format(metrics.activeGenerationJobs)}</strong><small>AI jobs currently active</small></span></div>
          </div>
          <div className="admin-insight-grid">
            <section className="admin-panel admin-activity-panel">
              <div className="admin-panel-heading"><div><span className="admin-eyebrow">LEARNER ENGAGEMENT</span><h2>Weekly active students</h2><p>Unique students who recorded learning activity each day</p></div><span className="admin-panel-tag">LAST 7 DAYS</span></div>
              <div className="admin-chart" role="img" aria-label="Daily active students over the last seven days">
                {(overview?.activity||[]).map(item=><div className="admin-chart-column" key={item.day}><div className="admin-chart-value">{item.activeUsers}</div><div className="admin-chart-track"><span style={{height:Math.max(5,(item.activeUsers/activityMax)*100)+"%"}}/></div><small>{new Date(item.day+"T00:00:00+01:00").toLocaleDateString("en-GB",{weekday:"short"})}</small></div>)}
              </div>
              <div className="admin-chart-foot"><span><i/> Active students</span><span>Daily activity is based on ClerkME study-day records</span></div>
            </section>
            <section className="admin-panel admin-services-panel">
              <div className="admin-panel-heading"><div><span className="admin-eyebrow">CONNECTED SERVICES</span><h2>Platform readiness</h2><p>Configuration checks only; secrets are never displayed</p></div></div>
              <div className="admin-service-list">{Object.entries(overview?.services||{}).map(([key,ready])=><div className="admin-service-row" key={key}><span className="admin-service-status"><i className={ready?"is-ready":"is-missing"}/>{serviceLabels[key]||key}</span><strong className={ready?"is-ready-text":"is-missing-text"}>{ready?"Ready":"Not configured"}</strong></div>)}</div>
            </section>
            <section className="admin-panel admin-jobs-panel">
              <div className="admin-panel-heading"><div><span className="admin-eyebrow">AI OPERATIONS</span><h2>Study generation jobs</h2><p>Generation activity recorded over the last seven days</p></div></div>
              <div className="admin-job-summary"><div><strong>{numberFormat.format(metrics.activeGenerationJobs)}</strong><span>Currently queued or running</span></div><div><strong>{numberFormat.format(metrics.failedGenerationJobs7d)}</strong><span>Failed in the last 7 days</span></div></div>
              <div className="admin-job-chips">{(overview?.jobs||[]).map(job=><span key={job.status}>{prettyAction(job.status)} <b>{numberFormat.format(job.total)}</b></span>)}</div>
              <p className="admin-metering-note">AI token consumption and provider spend are not yet instrumented. These figures are job counts, not cost estimates.</p>
            </section>
            <section className="admin-panel admin-audit-panel">
              <div className="admin-panel-heading"><div><span className="admin-eyebrow">SECURITY & ACTIVITY</span><h2>Recent recorded actions</h2><p>Latest events captured by ClerkME’s audit log</p></div></div>
              {(overview?.events||[]).length===0?<div className="admin-empty-state">No audit events have been recorded yet.</div>:<div className="admin-event-list">{overview?.events.map(event=><div className="admin-event-row" key={event.id}><span className="admin-event-marker">•</span><div><strong>{prettyAction(event.action)}</strong><small>{event.userName}{event.userEmail?" · "+event.userEmail:""}</small></div><time>{timeLabel(event.createdAt)}</time></div>)}</div>}
            </section>
          </div>
        </>}
        {tab==="students"&&<>
          <div className="admin-page-heading admin-directory-heading"><div><span className="admin-eyebrow">ACCOUNT MANAGEMENT</span><h1>Student directory</h1><p>Review registered accounts, profile details and use of ClerkME learning tools.</p></div><span className="admin-directory-total">{numberFormat.format(directory?.total??metrics?.totalUsers??0)} accounts</span></div>
          <section className="admin-panel admin-directory-panel">
            <div className="admin-directory-toolbar"><div><h2>Registered students</h2><p>Read-only account directory. Account permissions remain controlled on the server.</p></div><form className="admin-search-form" onSubmit={submitSearch}><label className="admin-sr-only" htmlFor="admin-student-search">Search students</label><input id="admin-student-search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search name, email or university"/><button type="submit">Search</button></form></div>
            {directoryError&&<div className="admin-inline-error" role="alert">{directoryError}</div>}
            <div className="admin-table-wrap">
              <table className="admin-student-table">
                <thead><tr><th>STUDENT</th><th>UNIVERSITY & LEVEL</th><th>JOINED</th><th>LAST ACTIVE</th><th>CASES</th><th>MATERIALS</th><th>VIDEOS</th></tr></thead>
                <tbody>
                  {directoryLoading&&<tr><td colSpan={7} className="admin-table-message">Loading student records…</td></tr>}
                  {!directoryLoading&&directory?.users.map(student=><tr key={student.id}><td><div className="admin-student-identity"><span>{student.name.trim()[0]?.toUpperCase()||"S"}</span><div><strong>{student.name||"ClerkME student"}</strong><small>{student.email}</small></div></div></td><td><strong>{student.university||"Not supplied"}</strong><small className="admin-cell-subtext">{student.level||"Level not supplied"}</small></td><td>{timeLabel(student.createdAt).split(",")[0]}</td><td>{dateLabel(student.lastActive)}</td><td>{numberFormat.format(student.caseCount)}</td><td>{numberFormat.format(student.materialCount)}</td><td>{numberFormat.format(student.videoCount)}</td></tr>)}
                  {!directoryLoading&&directory&&directory.users.length===0&&<tr><td colSpan={7} className="admin-table-message">No student accounts match this search.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="admin-pagination"><span>{directory?"Showing "+(directory.total===0?0:((directory.page-1)*directory.perPage+1))+"–"+Math.min(directory.page*directory.perPage,directory.total)+" of "+numberFormat.format(directory.total):"Student records"}</span><div><button type="button" disabled={!directory||directory.page<=1||directoryLoading} onClick={()=>setPage(value=>Math.max(1,value-1))}>Previous</button><span>Page {directory?.page||page} of {directory?.totalPages||1}</span><button type="button" disabled={!directory||directory.page>=directory.totalPages||directoryLoading} onClick={()=>setPage(value=>value+1)}>Next</button></div></div>
          </section>
          <p className="admin-readonly-note">This release is intentionally read-only. Suspension, role editing and account deletion are not enabled until separate audited controls and recovery safeguards are implemented.</p>
        </>}
      </section>
    </div>
  </main>;
}
