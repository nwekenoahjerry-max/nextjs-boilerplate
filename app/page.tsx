"use client";

import { useEffect, useState } from "react";
import { clinicalUnits, questionBank } from "../lib/learning-content";
import { extractStudyFile } from "../lib/file-text";
import ClinicalGuides from "./clinical-guides";
import MaterialsPanel from "./materials-panel";
import AdaptiveFlightGame from "./adaptive-flight-game";
import LearningQuestionBank from "./learning-question-bank";
import ClinicalSimulation from "./clinical-simulation";

const navItems = [
  ["Overview", "overview", "⌂"],
  ["New clerking", "clerking", "＋"],
  ["My patients", "patients", "▤"],
  ["My materials", "materials", "▧"],
  ["Clinical guides", "guides", "✚"],
  ["OSCE & Viva", "osce", "◉"],
  ["Clinical simulation", "simulation", "✦"],
  ["Question bank", "qbank", "▦"],
  ["Flight game", "game", "✈"],
];

const templates = [
  { title: "General medical clerking", detail: "Presenting complaint, HPC, PMH, drug and social history", tag: "MEDICINE", icon: "✚" },
  { title: "Paediatric clerking", detail: "Birth history, development, immunisation and nutrition", tag: "PAEDIATRICS", icon: "♧" },
  { title: "Obstetric history", detail: "Antenatal, intrapartum, gynaecological and obstetric history", tag: "OBSTETRICS", icon: "♡" },
  { title: "Surgical clerking", detail: "Surgical history, focused examination and peri-operative review", tag: "SURGERY", icon: "⌁" },
];


export default function Home() {
  const [active, setActive] = useState("overview");

  const [osceUnit, setOsceUnit] = useState("general-medicine");
  const [osceIndex, setOsceIndex] = useState(0);
  const [osceReveal, setOsceReveal] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [rawClerkingNotes,setRawClerkingNotes]=useState("");
  const [organisedClerkingProse,setOrganisedClerkingProse]=useState("");
  const [organiseLoading,setOrganiseLoading]=useState(false);
  const [organiseError,setOrganiseError]=useState("");
  const [organiseMissing,setOrganiseMissing]=useState<string[]>([]);
  const [organiseUnclear,setOrganiseUnclear]=useState<string[]>([]);
  const [streakData,setStreakData]=useState<{streak:number;bestStreak:number;activeDays:number;todayActive:boolean}>({streak:0,bestStreak:0,activeDays:0,todayActive:false});
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
  useEffect(() => { if(!authUser)return; fetch("/api/activity",{method:"POST",credentials:"same-origin"}).then(r=>r.ok?r.json():null).then(d=>{if(d)setStreakData(d);}).catch(()=>{}); },[authUser]);
  useEffect(() => {
    const navigate = (event: Event) => {
      const section = (event as CustomEvent<{section?: string}>).detail?.section;
      if (section) setActive(section);
    };
    window.addEventListener("clerkme:navigate", navigate);
    return () => window.removeEventListener("clerkme:navigate", navigate);
  }, []);
  const loadCases = async () => { const r = await fetch("/api/cases"); if (r.status === 401) { window.location.href = "/login"; return; } const d = await r.json(); if (r.ok) setCaseList(d.cases || []); else setApiError(d.error || "Could not load cases."); };
  useEffect(() => { if (active === "patients" && authUser) loadCases(); }, [active, authUser]);
  const saveCase = async () => { if (!authUser) { window.location.href = "/login"; return; } setSaving(true); setApiError(""); try { const r = await fetch("/api/cases", { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"same-origin", body:JSON.stringify({caseReference:patientName,title:"Clinical case " + patientName,presentingComplaint:complaint,specialty:selectedSpecialty,history:{historyOfPresentingComplaint:hpc,pastMedicalAndSurgicalHistory:pastHistory,medicationHistory:medications,allergies,familyHistory,socialHistory,reviewOfSystems:systemsReview,rawClerkingNotes,formattedProse:organisedClerkingProse},examination:{vitalSigns:vitals,findings:examination},assessment:{clinicalSummary:assessment,differentialDiagnoses:differentials},plan:{managementPlan:plan}}) }); const d=await r.json(); if (!r.ok) throw new Error(d.error || "Could not save case."); setSaved(true); setActive("patients"); await loadCases(); } catch(e) { setApiError(e instanceof Error ? e.message : "Could not save case."); } finally { setSaving(false); } };

  const startClerking = () => { setActive("clerking"); setShowNew(true); setSaved(false); };
  const organiseClerking = async () => {
    setOrganiseLoading(true); setOrganiseError(""); setOrganisedClerkingProse(""); setOrganiseMissing([]); setOrganiseUnclear([]);
    try {
      const r = await fetch("/api/learning/organise", { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"same-origin", body:JSON.stringify({unit:selectedSpecialty,complaint,notes:rawClerkingNotes}) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not organise the notes.");
      fetch("/api/activity",{method:"POST",credentials:"same-origin"}).catch(()=>{});
      setOrganisedClerkingProse(d.prose || "");
      setOrganiseMissing(Array.isArray(d.missingInformation) ? d.missingInformation : []);
      setOrganiseUnclear(Array.isArray(d.unclearOrContradictory) ? d.unclearOrContradictory : []);
    } catch(e) { setOrganiseError(e instanceof Error ? e.message : "Could not organise the notes."); }
    finally { setOrganiseLoading(false); }
  };

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
          <a className="profile profile-link" href="/profile"><div className="avatar">{authUser?.name?.[0] || "C"}</div><div><strong>{authUser?.name || "Medical student"}</strong><small>View and edit profile</small></div><span className="profile-dots">↗</span></a>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar"><a className="mobile-brand" href="#overview" onClick={() => setActive("overview")}><span className="brand-mark">C<span>+</span></span><strong>clerk<span>me</span></strong></a><div className="breadcrumb">Workspace <span>/</span> <strong>{navItems.find(x => x[1] === active)?.[0] || "Overview"}</strong></div><div className="top-actions"><a className="profile-top-link" href="/profile">My profile</a><span className="status-dot"></span><span className="saved-label">{authUser ? authUser.name : "Your workspace"}</span>{authUser ? <button className="help-button" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});window.location.reload();}}>↪</button> : <a className="sign-in-link" href="/login">Sign in</a>}<div className="avatar small-avatar">{authUser?.name?.[0] || "C"}</div></div></header>
        <div className="content">
          {active === "overview" && <>
            <div className="welcome-row"><div><div className="eyebrow">YOUR CLINICAL WORKSPACE</div><h1>Good day. Ready to sharpen<br className="desktop-break"/> your clinical skills?</h1><p className="subheading">A calmer, more structured way to learn the art of clinical clerking.</p></div><div className="date-chip"><span>✧</span> Learn • Practise • Improve</div></div>
            <div className="activity-streak-card"><div className="streak-flame">✦</div><div><strong>{streakData.streak} day learning streak</strong><span>{authUser?(streakData.todayActive?"You have checked in today. Keep learning tomorrow.":"Your learning activity will update when you open ClerkMe."):"Sign in to track your daily learning streak."}</span></div><div className="streak-record"><small>PERSONAL BEST</small><b>{streakData.bestStreak} days</b></div></div>
            <div className="hero-card"><div className="hero-copy"><span className="hero-kicker">YOUR NEXT PATIENT STARTS HERE</span><h2>Every great diagnosis<br/>begins with a good history.</h2><p>Capture the story. Examine with purpose. Organise your findings. Practise clinical reasoning with a clear structure.</p><button className="primary-button" onClick={startClerking}>Start a new clerking <span>→</span></button></div><div className="hero-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="medical-cross">✚</div><div className="art-note note-one"><span>01</span> History</div><div className="art-note note-two"><span>02</span> Examination</div><div className="art-note note-three"><span>03</span> Assessment</div></div></div>
            <div className="section-heading"><div><h2>Your clinical workspace</h2><p>Move from structured clerking to active recall, simulation and independent learning.</p></div><button className="text-link" onClick={() => setActive("guides")}>Explore clinical guides <span>→</span></button></div>
            <div className="tool-grid">
              <button className="tool-card" onClick={startClerking}><span className="tool-icon mint">＋</span><span className="tool-title">Clinical clerking</span><span className="tool-desc">Take a complete, organised patient history.</span><span className="tool-arrow">↗</span></button>
              <button className="tool-card" onClick={() => setActive("guides")}><span className="tool-icon sand">▤</span><span className="tool-title">Clinical guides</span><span className="tool-desc">Refresh key concepts and examination steps.</span><span className="tool-arrow">↗</span></button>
              <button className="tool-card" onClick={() => setActive("osce")}><span className="tool-icon lilac">◉</span><span className="tool-title">OSCE & Viva</span><span className="tool-desc">Prepare for practical and oral examinations.</span><span className="tool-arrow">↗</span></button>
              <button className="tool-card" onClick={() => setActive("qbank")}><span className="tool-icon blue">▦</span><span className="tool-title">Question bank</span><span className="tool-desc">Test your knowledge with clinical questions.</span><span className="tool-arrow">↗</span></button>
              <button className="tool-card" onClick={() => setActive("materials")}><span className="tool-icon mint">▧</span><span className="tool-title">My materials</span><span className="tool-desc">Upload lectures, build clear summaries and ask source-based questions.</span><span className="tool-arrow">↗</span></button>
              <button className="tool-card" onClick={() => setActive("simulation")}><span className="tool-icon lilac">✦</span><span className="tool-title">Clinical simulation</span><span className="tool-desc">Work through fictional cases and get examiner-style feedback.</span><span className="tool-arrow">↗</span></button>
              <button className="tool-card" onClick={() => setActive("game")}><span className="tool-icon sand">✈</span><span className="tool-title">Flight Academy</span><span className="tool-desc">Practise with questions adapted to your unit and study materials.</span><span className="tool-arrow">↗</span></button>
            </div>
            <div className="lower-grid"><section className="panel"><div className="panel-heading"><div><h3>Popular clerking templates</h3><p>Choose a structure to guide your assessment.</p></div><button className="text-link" onClick={() => setActive("clerking")}>See all →</button></div><div className="template-list">{templates.map(t => <button className="template-row" key={t.title} onClick={startClerking}><span className="template-icon">{t.icon}</span><span className="template-info"><strong>{t.title}</strong><small>{t.detail}</small></span><span className="template-tag">{t.tag}</span><span className="row-arrow">↗</span></button>)}</div></section><section className="tip-panel"><div className="tip-symbol">✦</div><div className="eyebrow">CLINICAL PEARL</div><h3>Listen before you lead.</h3><p>Begin with an open question. Allow the patient to tell their story before narrowing the history with focused questions.</p><div className="tip-footer">THE ART OF CLINICAL CLERKING <span>01 / 05</span></div></section></div>
            <footer className="footer-note">ClerkMe is a learning and documentation companion. Clinical decisions must always be made by a qualified healthcare professional.</footer>
          </>}

          {active === "clerking" && <><div className="page-intro"><div className="eyebrow">PATIENT ASSESSMENT</div><h1>Clinical clerking</h1><p>Choose a structured template and organise your patient encounter.</p></div><div className="template-grid">{templates.map(t => <button className="template-card" key={t.title} onClick={() => { setSelectedSpecialty(t.tag === "PAEDIATRICS" ? "paediatrics" : t.tag === "OBSTETRICS" ? "obstetrics-gynaecology" : t.tag === "SURGERY" ? "surgery" : "general-medicine"); setShowNew(true); setSaved(false); }}><span className="template-icon large">{t.icon}</span><span className="template-tag">{t.tag}</span><h3>{t.title}</h3><p>{t.detail}</p><span className="card-action">Use template →</span></button>)}</div>{showNew && <div className="form-panel"><div className="panel-heading"><div><h3>Start a new patient clerking</h3><p>Use a non-identifying study reference. Do not enter patient names, hospital numbers or contact details.</p></div><button className="close-button" onClick={() => setShowNew(false)}>×</button></div>
            <div className="clerking-note-panel"><div className="clerking-note-heading"><div><span className="eyebrow">CLERKING NOTE ORGANISER</span><h3>Organise rough notes into a clear clinical history</h3><p>Upload a document or paste your notes. ClerkMe will arrange the information you provide and identify details that still need to be checked.</p></div><span className="upload-icon">✎</span></div>
              <label className="slide-file-picker"><span>⇧</span><span><strong>Upload existing clerking notes</strong><small>DOCX, PDF, TXT or Markdown · remove names and hospital identifiers first</small></span><input type="file" accept=".docx,.pdf,.txt,.md" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setOrganiseError("");try{const extracted=await extractStudyFile(file);setRawClerkingNotes(extracted.text);}catch(err){setOrganiseError(err instanceof Error?err.message:"Could not read that file.");}}}/></label>
              <label>Paste or edit your raw clerking notes<textarea rows={7} value={rawClerkingNotes} onChange={e=>setRawClerkingNotes(e.target.value)} placeholder="Paste your rough notes here: presenting complaint, chronology, associated symptoms, relevant negatives, past history, medications, examination and assessment…"/></label>
              <button className="primary-button" onClick={organiseClerking} disabled={organiseLoading||rawClerkingNotes.trim().length<30}>{organiseLoading?"Organising your clerking…":"Organise into clinical prose"} <span>→</span></button>
              {organiseError&&<p className="auth-error">{organiseError}</p>}
              {organisedClerkingProse&&<div className="organised-prose"><div className="panel-heading"><h3>Organised clinical history</h3><button className="text-link" onClick={()=>navigator.clipboard?.writeText(organisedClerkingProse)}>Copy prose</button></div><pre>{organisedClerkingProse}</pre>{organiseMissing.length>0&&<div className="prose-followups"><strong>Information still to obtain</strong><ul>{organiseMissing.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}{organiseUnclear.length>0&&<div className="prose-followups"><strong>Unclear or conflicting details to verify</strong><ul>{organiseUnclear.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}<small>Check every sentence against the original notes before using or saving this write-up. ClerkMe does not add missing clinical facts.</small></div>}
            </div>
            <label>Patient study identifier<input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. Case 001"/></label><label>Presenting complaint<input value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="e.g. Fever for 5 days"/></label>
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
          {active === "guides" && <ClinicalGuides/>}
          {active === "materials" && <MaterialsPanel/>}
          {active === "osce" && <><div className="page-intro"><div className="eyebrow">PRACTICAL EXAM PREPARATION</div><h1>OSCE & Viva practice</h1><p>Use unit-specific clinical prompts to practise your reasoning and oral presentation.</p></div><div className="learning-toolbar"><label>Choose your unit<select value={osceUnit} onChange={e=>{setOsceUnit(e.target.value);setOsceIndex(0);setOsceReveal(false);}}>{clinicalUnits.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><p>Read the stem, formulate your answer aloud, then reveal the teaching points.</p></div>{(()=>{const qs=questionBank.filter(q=>q.unit===osceUnit);const q=qs[osceIndex%qs.length];return q?<div className="osce-card"><div className="question-topline"><span>VIVA STATION {String(osceIndex+1).padStart(2,"0")}</span><span>{q.topic} · {q.level}</span></div><h2>{q.q}</h2><p className="osce-instruction">Before revealing the answer, state your most likely answer and explain your clinical reasoning as if presenting to an examiner.</p><button className="primary-button" onClick={()=>setOsceReveal(v=>!v)}>{osceReveal?"Hide teaching points":"Reveal teaching points"} <span>→</span></button>{osceReveal&&<div className="guide-section"><h3>Examiner's teaching points</h3><p><strong>Best answer:</strong> {q.o[q.a]}</p><p>{q.e}</p></div>}<button className="secondary-button" onClick={()=>{setOsceIndex(i=>i+1);setOsceReveal(false);}}>Next viva prompt →</button></div>:<p>No prompts are available for this unit yet.</p>})()}</>}
          {active === "game" && <><div className="page-intro"><div className="eyebrow">UNIT- AND MATERIAL-ADAPTIVE LEARNING</div><h1>Flight simulator</h1><p>Practise with questions from your current unit and the lecture materials you have uploaded.</p></div><AdaptiveFlightGame onOpenMaterials={()=>setActive("materials")}/></>}
          {active === "simulation" && <ClinicalSimulation/>}
          {active === "qbank" && <LearningQuestionBank/>}
        </div>
      </section>
    </main>
  );
}
