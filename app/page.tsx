"use client";

import { useEffect, useRef, useState } from "react";

const navItems = [
  ["Overview", "overview", "⌂"],
  ["New clerking", "clerking", "＋"],
  ["My patients", "patients", "▤"],
  ["Clinical guides", "guides", "✚"],
  ["OSCE & Viva", "osce", "◉"],
  ["Question bank", "qbank", "▦"],
  ["Flight game", "game", "✈"],
];

const templates = [
  { title: "General medical clerking", detail: "Presenting complaint, HPC, PMH, drug and social history", tag: "MEDICINE", icon: "✚" },
  { title: "Paediatric clerking", detail: "Birth history, development, immunisation and nutrition", tag: "PAEDIATRICS", icon: "♧" },
  { title: "Obstetric history", detail: "Antenatal, intrapartum, gynaecological and obstetric history", tag: "OBSTETRICS", icon: "♡" },
  { title: "Surgical clerking", detail: "Surgical history, focused examination and peri-operative review", tag: "SURGERY", icon: "⌁" },
];


function FlightGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const direction = useRef(0);
  const start = () => { setScore(0); setRunning(true); };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !running) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0, points = 0, last = 0, raf = 0, crashed = false;
    let jetX = canvas.width / 2, obstacles: Array<{x:number;y:number;w:number;h:number;speed:number}> = [];
    const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = canvas.clientWidth || 760; const h = 520; canvas.width = w*dpr; canvas.height = h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); };
    resize(); jetX = (canvas.clientWidth || 760)/2;
    const keyDown = (e:KeyboardEvent) => { if (["ArrowLeft","a","A"].includes(e.key)) direction.current=-1; if (["ArrowRight","d","D"].includes(e.key)) direction.current=1; };
    const keyUp = () => { direction.current=0; };
    window.addEventListener("keydown",keyDown); window.addEventListener("keyup",keyUp);
    const draw = (t:number) => {
      const w=canvas.clientWidth||760,h=520; ctx.clearRect(0,0,w,h);
      const bg=ctx.createLinearGradient(0,0,0,h); bg.addColorStop(0,"#07182b"); bg.addColorStop(1,"#123c55"); ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle="rgba(155,208,230,.12)"; ctx.lineWidth=1;
      for(let y=(frame*2)%48;y<h;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      for(let x=30;x<w;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
      // distant cloud banks and speed streaks
      for(let i=0;i<9;i++){const y=(i*91+frame*3)%(h+80)-40;ctx.fillStyle="rgba(205,231,239,.08)";ctx.beginPath();ctx.ellipse((i*137+60)%w,y,34,5,0,0,Math.PI*2);ctx.fill();}
      if(frame%72===0) obstacles.push({x:35+Math.random()*(w-100),y:-45,w:45+Math.random()*28,h:28+Math.random()*20,speed:3+Math.min(points/500,4)});
      obstacles=obstacles.filter(o=>o.y<h+60);
      obstacles.forEach(o=>{o.y+=o.speed;ctx.save();ctx.shadowColor="#ff6d4e";ctx.shadowBlur=15;ctx.fillStyle="#d75b45";ctx.beginPath();ctx.roundRect(o.x,o.y,o.w,o.h,8);ctx.fill();ctx.fillStyle="#ffb18e";ctx.fillRect(o.x+8,o.y+7,o.w-16,3);ctx.restore();});
      jetX += direction.current*5; jetX=Math.max(32,Math.min(w-32,jetX));
      const jy=h-105;
      // exhaust
      const flame=ctx.createLinearGradient(0,jy+25,0,jy+80);flame.addColorStop(0,"#fff2a6");flame.addColorStop(1,"rgba(255,115,42,0)");
      ctx.fillStyle=flame;ctx.beginPath();ctx.moveTo(jetX-8,jy+15);ctx.lineTo(jetX+8,jy+15);ctx.lineTo(jetX,jy+76+Math.sin(frame/3)*8);ctx.fill();
      // modern fighter jet, nose pointing upwards
      ctx.save();ctx.translate(jetX,jy);ctx.shadowColor="#77d8f2";ctx.shadowBlur=18;
      const body=ctx.createLinearGradient(-18,0,18,0);body.addColorStop(0,"#647b8d");body.addColorStop(.48,"#edf4f7");body.addColorStop(1,"#52697c");
      ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(0,-48);ctx.quadraticCurveTo(8,-27,10,3);ctx.lineTo(29,29);ctx.lineTo(28,37);ctx.lineTo(8,28);ctx.lineTo(6,44);ctx.lineTo(-6,44);ctx.lineTo(-8,28);ctx.lineTo(-28,37);ctx.lineTo(-29,29);ctx.lineTo(-10,3);ctx.quadraticCurveTo(-8,-27,0,-48);ctx.fill();
      ctx.fillStyle="#7bd4ec";ctx.beginPath();ctx.ellipse(0,-13,5,12,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#253c50";ctx.fillRect(-3,5,6,20);ctx.restore();
      if(obstacles.some(o=>Math.abs((o.x+o.w/2)-jetX)<o.w/2+17 && Math.abs((o.y+o.h/2)-jy)<o.h/2+27)){crashed=true;setBest(b=>Math.max(b,Math.floor(points)));setRunning(false);}
      points+=0.12; frame++; if(frame%10===0)setScore(Math.floor(points));
      ctx.fillStyle="#fff";ctx.font="700 17px Arial";ctx.fillText("ALTITUDE  "+Math.floor(points*120)+" FT",20,32);
      ctx.font="11px Arial";ctx.fillStyle="#b7d5e3";ctx.fillText("DODGE THE FLIGHT HAZARDS",20,51);
      if(!crashed) raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",keyDown);window.removeEventListener("keyup",keyUp);};
  },[running]);
  return <section className="flight-game"><div className="flight-head"><div><span className="eyebrow">ARCADE FLIGHT SIMULATOR</span><h2>Skyward: Jet Run</h2><p>Keep climbing. Avoid the hazards. How far can you fly?</p></div><div className="flight-stats"><span>ALTITUDE <strong>{score.toLocaleString()} ft</strong></span><span>BEST <strong>{best.toLocaleString()} ft</strong></span></div></div><div className="flight-screen"><canvas ref={canvasRef} aria-label="Jet flying upwards through an obstacle course"/>{!running&&<div className="flight-overlay"><div className="flight-overlay-card"><div className="flight-jet-icon">✈</div><h3>{score>0?"Flight ended":"Ready for take-off?"}</h3><p>Fly vertically through the sky. Steer left and right to avoid incoming hazards.</p><button className="primary-button" onClick={start}>{score>0?"Fly again":"Start flight"} →</button></div></div>}</div><div className="flight-controls"><span>CONTROLS: ← → or A / D</span><div><button onPointerDown={()=>direction.current=-1} onPointerUp={()=>direction.current=0} onPointerLeave={()=>direction.current=0} aria-label="Steer left">←</button><button onPointerDown={()=>direction.current=1} onPointerUp={()=>direction.current=0} onPointerLeave={()=>direction.current=0} aria-label="Steer right">→</button></div></div></section>;
}


export default function Home() {
  const [active, setActive] = useState("overview");
  const [showNew, setShowNew] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [complaint, setComplaint] = useState("");
  const [saved, setSaved] = useState(false);
  const [authUser, setAuthUser] = useState<{name:string;email:string}|null>(null);
  const [apiError, setApiError] = useState("");
  const [caseList, setCaseList] = useState<Array<{id:string;title:string;case_reference:string;specialty:string;presenting_complaint:string;status:string;updated_at:string}>>([]);
  const [saving, setSaving] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState("general-medicine");
  const [hpc, setHpc] = useState("");
  const [pastHistory, setPastHistory] = useState("");
  const [medications, setMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const [familyHistory, setFamilyHistory] = useState("");
  const [socialHistory, setSocialHistory] = useState("");
  const [systemsReview, setSystemsReview] = useState("");
  const [vitals, setVitals] = useState("");
  const [examination, setExamination] = useState("");
  const [assessment, setAssessment] = useState("");
  const [differentials, setDifferentials] = useState("");
  const [plan, setPlan] = useState("");
  useEffect(() => { fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => { if (d?.user) setAuthUser(d.user); }).catch(() => {}); }, []);
  const loadCases = async () => { const r = await fetch("/api/cases"); if (r.status === 401) { window.location.href = "/login"; return; } const d = await r.json(); if (r.ok) setCaseList(d.cases || []); else setApiError(d.error || "Could not load cases."); };
  useEffect(() => { if (active === "patients" && authUser) loadCases(); }, [active, authUser]);
  const saveCase = async () => { if (!authUser) { window.location.href = "/login"; return; } setSaving(true); setApiError(""); try { const r = await fetch("/api/cases", { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"same-origin", body:JSON.stringify({caseReference:patientName,title:"Clinical case " + patientName,presentingComplaint:complaint,specialty:selectedSpecialty,history:{historyOfPresentingComplaint:hpc,pastMedicalAndSurgicalHistory:pastHistory,medicationHistory:medications,allergies,familyHistory,socialHistory,reviewOfSystems:systemsReview},examination:{vitalSigns:vitals,findings:examination},assessment:{clinicalSummary:assessment,differentialDiagnoses:differentials},plan:{managementPlan:plan}}) }); const d=await r.json(); if (!r.ok) throw new Error(d.error || "Could not save case."); setSaved(true); setActive("patients"); await loadCases(); } catch(e) { setApiError(e instanceof Error ? e.message : "Could not save case."); } finally { setSaving(false); } };

  const startClerking = () => { setActive("clerking"); setShowNew(true); setSaved(false); };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setActive("overview")}>
          <span className="brand-mark">C<span>+</span></span>
          <span><strong>clerk<span>me</span></strong><small>CLINICAL COMPANION</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          {navItems.map(([label, id, icon]) => (
            <button key={id} className={active === id ? "nav-item active" : "nav-item"} onClick={() => { setActive(id); setShowNew(id === "clerking"); }}>
              <span className="nav-icon">{icon}</span>{label}
              {id === "clerking" && <span className="nav-plus">+</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card"><div className="upgrade-icon">✦</div><strong>Learn with confidence</strong><p>Build your clinical skills, one patient at a time.</p><button onClick={() => setActive("guides")}>Explore guides <span>↗</span></button></div>
          <a className="profile profile-link" href="/profile"><div className="avatar">{authUser?.name?.[0] || "N"}</div><div><strong>{authUser?.name || "Medical student"}</strong><small>View and edit profile</small></div><span className="profile-dots">↗</span></a>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{navItems.find(x => x[1] === active)?.[0] || "Overview"}</strong></div><div className="top-actions"><span className="status-dot"></span><span className="saved-label">{authUser ? authUser.name : "Your workspace"}</span>{authUser ? <button className="help-button" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});window.location.reload();}}>↪</button> : <a className="sign-in-link" href="/login">Sign in</a>}<div className="avatar small-avatar">{authUser?.name?.[0] || "N"}</div></div></header>
        <div className="content">
          {active === "overview" && <>
            <div className="welcome-row"><div><div className="eyebrow">YOUR CLINICAL WORKSPACE</div><h1>Good day. Ready to sharpen<br className="desktop-break"/> your clinical skills?</h1><p className="subheading">A calmer, more structured way to learn the art of clinical clerking.</p></div><div className="date-chip"><span>✧</span> Learn • Practise • Improve</div></div>
            <div className="hero-card"><div className="hero-copy"><span className="hero-kicker">YOUR NEXT PATIENT STARTS HERE</span><h2>Every great diagnosis<br/>begins with a good history.</h2><p>Capture the story. Examine with purpose. Organise your findings. Practise clinical reasoning with a clear structure.</p><button className="primary-button" onClick={startClerking}>Start a new clerking <span>→</span></button></div><div className="hero-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="medical-cross">✚</div><div className="art-note note-one"><span>01</span> History</div><div className="art-note note-two"><span>02</span> Examination</div><div className="art-note note-three"><span>03</span> Assessment</div></div></div>
            <div className="section-heading"><div><h2>Your clinical toolkit</h2><p>Structured resources for every stage of patient assessment.</p></div><button className="text-link" onClick={() => setActive("guides")}>View all resources <span>→</span></button></div>
            <div className="tool-grid">
              <button className="tool-card" onClick={startClerking}><span className="tool-icon mint">＋</span><span className="tool-title">Clinical clerking</span><span className="tool-desc">Take a complete, organised patient history.</span><span className="tool-arrow">↗</span></button>
              <button className="tool-card" onClick={() => setActive("guides")}><span className="tool-icon sand">▤</span><span className="tool-title">Clinical guides</span><span className="tool-desc">Refresh key concepts and examination steps.</span><span className="tool-arrow">↗</span></button>
              <button className="tool-card" onClick={() => setActive("osce")}><span className="tool-icon lilac">◉</span><span className="tool-title">OSCE & Viva</span><span className="tool-desc">Prepare for practical and oral examinations.</span><span className="tool-arrow">↗</span></button>
              <button className="tool-card" onClick={() => setActive("qbank")}><span className="tool-icon blue">▦</span><span className="tool-title">Question bank</span><span className="tool-desc">Test your knowledge with clinical questions.</span><span className="tool-arrow">↗</span></button>
            </div>
            <div className="lower-grid"><section className="panel"><div className="panel-heading"><div><h3>Popular clerking templates</h3><p>Choose a structure to guide your assessment.</p></div><button className="text-link" onClick={() => setActive("clerking")}>See all →</button></div><div className="template-list">{templates.slice(0,3).map(t => <button className="template-row" key={t.title} onClick={startClerking}><span className="template-icon">{t.icon}</span><span className="template-info"><strong>{t.title}</strong><small>{t.detail}</small></span><span className="template-tag">{t.tag}</span><span className="row-arrow">↗</span></button>)}</div></section><section className="tip-panel"><div className="tip-symbol">✦</div><div className="eyebrow">CLINICAL PEARL</div><h3>Listen before you lead.</h3><p>Begin with an open question. Allow the patient to tell their story before narrowing the history with focused questions.</p><div className="tip-footer">THE ART OF CLINICAL CLERKING <span>01 / 05</span></div></section></div>
            <footer className="footer-note">ClerkMe is a learning and documentation companion. Clinical decisions must always be made by a qualified healthcare professional.</footer>
          </>}

          {active === "clerking" && <><div className="page-intro"><div className="eyebrow">PATIENT ASSESSMENT</div><h1>Clinical clerking</h1><p>Choose a structured template and organise your patient encounter.</p></div><div className="template-grid">{templates.map(t => <button className="template-card" key={t.title} onClick={() => { setSelectedSpecialty(t.tag === "PAEDIATRICS" ? "paediatrics" : t.tag === "OBSTETRICS" ? "obstetrics-gynaecology" : t.tag === "SURGERY" ? "surgery" : "general-medicine"); setShowNew(true); setSaved(false); }}><span className="template-icon large">{t.icon}</span><span className="template-tag">{t.tag}</span><h3>{t.title}</h3><p>{t.detail}</p><span className="card-action">Use template →</span></button>)}</div>{showNew && <div className="form-panel"><div className="panel-heading"><div><h3>Start a new patient clerking</h3><p>Use a non-identifying study reference. Do not enter patient names, hospital numbers or contact details.</p></div><button className="close-button" onClick={() => setShowNew(false)}>×</button></div><label>Patient study identifier<input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. Case 001"/></label><label>Presenting complaint<input value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="e.g. Fever for 5 days"/></label>
            <div className="clerking-section-title">01 · HISTORY OF PRESENTING COMPLAINT</div>
            <label>History of presenting complaint<textarea value={hpc} onChange={e=>setHpc(e.target.value)} placeholder="Onset, duration, progression, character, associated symptoms, aggravating and relieving factors, relevant negatives…" rows={4}/></label>
            <div className="clerking-fields"><label>Past medical and surgical history<textarea value={pastHistory} onChange={e=>setPastHistory(e.target.value)} rows={3}/></label><label>Medication history<textarea value={medications} onChange={e=>setMedications(e.target.value)} rows={3}/></label><label>Allergies<textarea value={allergies} onChange={e=>setAllergies(e.target.value)} rows={2}/></label><label>Family history<textarea value={familyHistory} onChange={e=>setFamilyHistory(e.target.value)} rows={2}/></label><label>Social history<textarea value={socialHistory} onChange={e=>setSocialHistory(e.target.value)} rows={2}/></label><label>Review of systems<textarea value={systemsReview} onChange={e=>setSystemsReview(e.target.value)} rows={3}/></label></div>
            <div className="clerking-section-title">02 · PHYSICAL EXAMINATION</div>
            <label>Vital signs<textarea value={vitals} onChange={e=>setVitals(e.target.value)} placeholder="BP, pulse, respiratory rate, temperature, SpO₂, weight…" rows={2}/></label>
            <label>Examination findings<textarea value={examination} onChange={e=>setExamination(e.target.value)} placeholder="General examination and relevant systemic examination findings…" rows={4}/></label>
            <div className="clerking-section-title">03 · CLINICAL ASSESSMENT</div>
            <label>Clinical summary<textarea value={assessment} onChange={e=>setAssessment(e.target.value)} rows={3}/></label>
            <label>Differential diagnoses<textarea value={differentials} onChange={e=>setDifferentials(e.target.value)} rows={3}/></label>
            <div className="clerking-section-title">04 · PLAN</div>
            <label>Investigation and management plan<textarea value={plan} onChange={e=>setPlan(e.target.value)} rows={4}/></label>
            <button className="primary-button" onClick={saveCase} disabled={!patientName.trim() || !complaint.trim() || saving}>{saving ? "Saving…" : "Save case securely"} <span>→</span></button>{apiError && <p className="auth-error">{apiError}</p>}{saved && <p className="success-note">Your case has been saved to your account.</p>}{!authUser && <p className="auth-message">Sign in is required to save cases. <a href="/login">Sign in with Google</a>.</p>}</div>}</>}

          {active === "patients" && <><div className="page-intro"><div className="eyebrow">PRIVATE CASE LIBRARY</div><h1>My cases</h1><p>Cases are visible only to the account that created them.</p></div><button className="primary-button" onClick={loadCases}>Refresh cases</button>{!authUser ? <div className="empty-state"><p>Sign in to view your saved cases.</p><a className="sign-in-link" href="/login">Sign in with Google</a></div> : <div className="panel case-library">{caseList.length ? caseList.map(c=><div className="template-row" key={c.id}><span className="template-icon">▤</span><span className="template-info"><strong>{c.title} · {c.case_reference}</strong><small>{c.specialty} · {c.presenting_complaint}</small></span><span className="template-tag">{c.status}</span></div>) : <div className="empty-state"><p>No saved cases yet. Start your first clerking.</p><button className="primary-button" onClick={startClerking}>Start a clerking →</button></div>}</div>}</> }
          {active === "guides" && <><div className="page-intro"><div className="eyebrow">LEARN WITH STRUCTURE</div><h1>Clinical guides</h1><p>Quick-reference learning areas to support your clinical rotations.</p></div><div className="resource-grid">{["History taking & communication","General physical examination","Cardiovascular examination","Respiratory examination","Abdominal examination","Neurological examination","Paediatric assessment","Obstetric assessment"].map((x,i)=><div className="resource-card" key={x}><span className="resource-number">0{i+1}</span><h3>{x}</h3><p>Structured approach, key questions and examination checkpoints.</p><span className="coming-soon">LEARNING CONTENT COMING SOON</span></div>)}</div></>}
          {active === "osce" && <div className="empty-state"><span className="empty-icon">◉</span><div className="eyebrow">PRACTICAL EXAM PREPARATION</div><h1>OSCE & Viva practice</h1><p>Practise station structure, clinical presentation and viva-style questions.</p><div className="coming-soon large-label">PRACTICE MODULE IN DEVELOPMENT</div></div>}
          {active === "game" && <><div className="page-intro"><div className="eyebrow">TAKE A BREAK · TEST YOUR REFLEXES</div><h1>Flight simulator</h1><p>A continuous arcade flight challenge. Stay airborne for as long as you can.</p></div><FlightGame/></>}
          {active === "qbank" && <div className="empty-state"><span className="empty-icon">▦</span><div className="eyebrow">TEST YOUR KNOWLEDGE</div><h1>Clinical question bank</h1><p>Build confidence with topic-based questions, timed tests and explanations.</p><div className="coming-soon large-label">QUESTION BANK IN DEVELOPMENT</div></div>}
        </div>
      </section>
    </main>
  );
}
