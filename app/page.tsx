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


const flightQuestions = [
  { topic:"CARDIOLOGY", difficulty:"FOUNDATION", question:"A 58-year-old man presents with crushing central chest pain radiating to his left arm. Which investigation should be obtained immediately?", options:["12-lead ECG","Echocardiography","Exercise stress test","CT pulmonary angiography"], answer:0, explanation:"A 12-lead ECG should be obtained promptly (ideally within 10 minutes) in suspected acute coronary syndrome. Do not delay emergency assessment or treatment." },
  { topic:"PAEDIATRICS", difficulty:"FOUNDATION", question:"A 2-year-old child has diarrhoea, sunken eyes and is unable to drink. What is the most appropriate classification?", options:["No dehydration","Some dehydration","Severe dehydration","Persistent diarrhoea"], answer:2, explanation:"Inability to drink, especially with other danger signs, is a feature of severe dehydration. Assess urgently and begin appropriate rehydration." },
  { topic:"OBSTETRICS", difficulty:"CLINICAL", question:"A woman at 34 weeks' gestation has BP 170/115 mmHg, severe headache and visual symptoms. What is the priority diagnosis?", options:["Gestational hypertension","Severe pre-eclampsia","Chronic hypertension","White-coat hypertension"], answer:1, explanation:"Severe-range hypertension with neurological symptoms after 20 weeks is consistent with pre-eclampsia with severe features. This is an obstetric emergency." },
  { topic:"MEDICINE", difficulty:"FOUNDATION", question:"Which electrolyte abnormality is classically associated with peaked T waves on an ECG?", options:["Hypokalaemia","Hypercalcaemia","Hyperkalaemia","Hyponatraemia"], answer:2, explanation:"Hyperkalaemia classically causes tall, peaked T waves and can progress to PR prolongation, QRS widening and life-threatening arrhythmias." },
  { topic:"SURGERY", difficulty:"CLINICAL", question:"A patient has right iliac fossa pain, fever and rebound tenderness. Which diagnosis is most likely?", options:["Acute appendicitis","Acute pancreatitis","Cholecystitis","Renal colic"], answer:0, explanation:"Migratory pain to the right iliac fossa with fever and localised peritoneal irritation strongly suggests acute appendicitis. Consider differentials and assess urgently." },
  { topic:"OBSTETRICS", difficulty:"FOUNDATION", question:"What is the first-line uterotonic used to prevent postpartum haemorrhage after vaginal birth?", options:["Magnesium sulphate","Oxytocin","Diazepam","Nifedipine"], answer:1, explanation:"Oxytocin is the standard first-line uterotonic for prevention of postpartum haemorrhage where available and not contraindicated." },
  { topic:"MEDICINE", difficulty:"CLINICAL", question:"Which clinical feature is most characteristic of left-sided heart failure?", options:["Ascites","Raised JVP alone","Pulmonary crepitations","Splenomegaly"], answer:2, explanation:"Left ventricular failure raises pulmonary venous pressure, producing pulmonary congestion and basal crepitations. Peripheral oedema and raised JVP are more typical of systemic venous congestion." },
  { topic:"PAEDIATRICS", difficulty:"CLINICAL", question:"A febrile 4-year-old is lethargic, has cold extremities and a capillary refill time of 5 seconds. What does this most strongly suggest?", options:["Adequate perfusion","Circulatory shock","Isolated mild fever","Simple febrile seizure"], answer:1, explanation:"Altered mental state, cold peripheries and prolonged capillary refill indicate poor perfusion and possible shock. Escalate immediately and follow emergency protocols." }
];

function FlightGame() {
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [altitude, setAltitude] = useState(1000);
  const [bestAltitude, setBestAltitude] = useState(1000);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [lastOutcome, setLastOutcome] = useState<"correct" | "wrong" | null>(null);
  const [lastChange, setLastChange] = useState(0);
  const question = flightQuestions[questionIndex % flightQuestions.length];
  const progress = Math.max(0, Math.min(100, altitude / 3000 * 100));

  const startFlight = () => {
    setStarted(true); setGameOver(false); setQuestionIndex(0); setAltitude(1000);
    setCorrectCount(0); setStreak(0); setSelected(null); setLastOutcome(null); setLastChange(0);
  };

  const answerQuestion = (optionIndex: number) => {
    if (selected !== null || gameOver) return;
    setSelected(optionIndex);
    if (optionIndex === question.answer) {
      const nextAltitude = altitude + 250;
      setAltitude(nextAltitude); setBestAltitude(value => Math.max(value, nextAltitude));
      setCorrectCount(value => value + 1); setStreak(value => value + 1);
      setLastOutcome("correct"); setLastChange(250);
    } else {
      const nextAltitude = Math.max(0, altitude - 300);
      setAltitude(nextAltitude); setStreak(0);
      setLastOutcome("wrong"); setLastChange(-300);
      if (nextAltitude === 0) setGameOver(true);
    }
  };

  const nextQuestion = () => {
    setQuestionIndex(value => value + 1); setSelected(null); setLastOutcome(null); setLastChange(0);
  };

  return (
    <section className="flight-quiz">
      <div className="flight-quiz-heading">
        <div><span className="eyebrow">CLINICAL KNOWLEDGE · FLIGHT CHALLENGE</span><h2>Skyward <span>Flight Academy</span></h2><p>Your knowledge is the engine. Every correct answer sends your jet higher.</p></div>
        <div className="flight-best"><span>PERSONAL BEST</span><strong>{bestAltitude.toLocaleString()} <small>FT</small></strong></div>
      </div>

      <div className="flight-dashboard">
        <div className="flight-visual-panel">
          <div className="flight-sky-label"><span className="live-dot"></span>{gameOver ? "FLIGHT COMPLETE" : started ? "FLIGHT IN PROGRESS" : "FLIGHT DECK READY"}</div>
          <div className="flight-altitude"><span>ALTITUDE</span><strong>{altitude.toLocaleString()}<small> FT</small></strong><div className="altitude-track"><span style={{height: progress + "%"}} /></div></div>
          <div className="flight-sky">
            <div className="sky-sun"></div><div className="sky-cloud cloud-a"></div><div className="sky-cloud cloud-b"></div><div className="sky-cloud cloud-c"></div>
            <div className="sky-cloud cloud-d"></div><div className="sky-cloud cloud-e"></div>
            <div className="flight-route-line"></div>
            <div className={"flight-plane " + (lastOutcome === "correct" ? "plane-boost" : lastOutcome === "wrong" ? "plane-drop" : "")} aria-label="Jet aircraft">
              <svg viewBox="0 0 120 150" role="img" aria-label="Silver jet pointing upwards"><defs><linearGradient id="jetMetal" x1="0" x2="1"><stop offset="0" stopColor="#647d91"/><stop offset=".48" stopColor="#f5fbff"/><stop offset="1" stopColor="#526b80"/></linearGradient><linearGradient id="jetFlame" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff5b0"/><stop offset="1" stopColor="#ff813d" stopOpacity="0"/></linearGradient></defs><path d="M54 104 L60 143 L66 104 Z" fill="url(#jetFlame)"/><path d="M60 7 C69 28 72 57 75 83 L109 111 L108 122 L72 108 L68 137 L52 137 L48 108 L12 122 L11 111 L45 83 C48 57 51 28 60 7Z" fill="url(#jetMetal)" stroke="#d9e8f1" strokeWidth="2"/><path d="M60 24 C66 42 66 54 64 66 L60 74 L56 66 C54 54 54 42 60 24Z" fill="#76d9f5"/><path d="M57 82 L63 82 L65 111 L55 111Z" fill="#304b61"/><path d="M17 113 L46 96 M103 113 L74 96" stroke="#9bb3c5" strokeWidth="2"/></svg>
            </div>
            <div className="sky-coordinate coord-one">N 06° 12′</div><div className="sky-coordinate coord-two">CLIMB RATE <b>{lastOutcome === "correct" ? "+250" : lastOutcome === "wrong" ? "−300" : "READY"}</b></div>
            {!started && <div className="flight-start-overlay"><div className="flight-start-icon">✈</div><strong>Ready for take-off?</strong><p>Answer clinical questions to control your altitude.</p><button className="flight-launch-button" onClick={startFlight}>Start your flight <span>→</span></button></div>}
            {gameOver && <div className="flight-start-overlay"><div className="flight-start-icon">◈</div><strong>You've landed</strong><p>Your aircraft has descended to ground level. Review, refuel and try again.</p><button className="flight-launch-button" onClick={startFlight}>Restart flight <span>↻</span></button></div>}
          </div>
          <div className="flight-metrics"><div><span>QUESTIONS CORRECT</span><strong>{correctCount}</strong></div><div><span>CURRENT STREAK</span><strong>{streak} <small>×</small></strong></div><div><span>QUESTIONS ANSWERED</span><strong>{questionIndex + (selected !== null ? 1 : 0)}</strong></div></div>
        </div>

        <div className="flight-question-panel">
          <div className="question-topline"><span>MISSION {String(questionIndex + 1).padStart(2,"0")}</span><span>{question.topic}</span></div>
          <div className="question-progress"><span style={{width: (((questionIndex % flightQuestions.length) + 1) / flightQuestions.length * 100) + "%"}} /></div>
          <div className="question-difficulty">{question.difficulty} QUESTION</div>
          <h3>{started && !gameOver ? question.question : "Your next clinical question is cleared for take-off."}</h3>
          {started && !gameOver ? <div className="flight-options">{question.options.map((option,index) => <button key={option} className={"flight-option " + (selected === null ? "" : index === question.answer ? "option-correct" : index === selected ? "option-wrong" : "option-muted")} onClick={() => answerQuestion(index)} disabled={selected !== null}><span className="option-letter">{String.fromCharCode(65+index)}</span><span>{option}</span><span className="option-mark">{selected !== null && index === question.answer ? "✓" : selected === index ? "×" : "↗"}</span></button>)}</div> : <div className="flight-mission-placeholder"><span>✦</span><p>Choose an answer to climb. A wrong answer reduces your altitude. Keep your aircraft above ground level to continue.</p></div>}
          {selected !== null && lastOutcome && <div className={"flight-feedback " + lastOutcome}><strong>{lastOutcome === "correct" ? "Excellent — altitude gained!" : "Not quite — altitude lost."}</strong><p>{question.explanation}</p><div className="altitude-change">{lastChange > 0 ? "+" : ""}{lastChange.toLocaleString()} FT</div>{!gameOver && <button onClick={nextQuestion}>Next mission <span>→</span></button>}</div>}
          {!started && <div className="flight-howto"><span>HOW TO PLAY</span><p><b>Correct answer</b> <i>+</i> 250 ft altitude</p><p><b>Wrong answer</b> <i>−</i> 300 ft altitude</p></div>}
          {gameOver && <div className="flight-game-over-note"><strong>Flight summary</strong><p>You answered {correctCount} question{correctCount === 1 ? "" : "s"} correctly and reached {bestAltitude.toLocaleString()} ft. Start again to beat your record.</p></div>}
        </div>
      </div>
      <div className="flight-quiz-footer"><span><i></i> CLINICAL LEARNING MODE · FOR EDUCATIONAL USE</span><span>QUESTION SET · {flightQuestions.length} QUESTIONS</span></div>
    </section>
  );
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
