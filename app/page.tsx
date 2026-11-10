"use client";

import { useEffect, useRef, useState } from "react";
import { clinicalUnits, questionBank, caseGuides } from "../lib/learning-content";
import { goodHistoryExamples } from "../lib/good-history";
import { extractStudyFile } from "../lib/file-text";

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


type PracticeQuestion = { id: string; unit: string; topic: string; level: string; q: string; o: string[]; a: number; e: string };
type GeneratedQuestion = { question: string; options: string[]; answerIndex: number; explanation: string; topic: string; difficulty: string };
const shuffleIndexes = (length: number) => Array.from({length}, (_,i)=>i).sort(()=>Math.random()-.5);
function mapGeneratedQuestions(items: GeneratedQuestion[], unit: string): PracticeQuestion[] {
  return items.map((item,i)=>({id:"upload-"+Date.now()+"-"+i,unit,topic:item.topic,level:item.difficulty,q:item.question,o:item.options,a:item.answerIndex,e:item.explanation}));
}
function SlideQuestionGenerator({ purpose, onGenerated }: { purpose: "bank"|"flight"; onGenerated: (questions: PracticeQuestion[], unit: string)=>void }) {
  const [unit,setUnit]=useState("general-medicine");
  const [file,setFile]=useState<File|null>(null);
  const [count,setCount]=useState(20);
  const [level,setLevel]=useState("Mixed");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [sourceChars,setSourceChars]=useState(0);
  const generate=async()=>{
    if(!file){setError("Choose a slide deck or lecture file first.");return;}
    setBusy(true);setError("");setMessage("");
    try{
      const extracted=await extractStudyFile(file);
      setSourceChars(extracted.text.length);
      const response=await fetch("/api/learning/generate",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({unit,sourceText:extracted.text,sourceTitle:extracted.name,count,level})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Could not generate questions.");
      const questions=mapGeneratedQuestions(data.questions||[],unit);
      if(!questions.length) throw new Error("No usable questions were returned. Try a different slide deck or a smaller question count.");
      onGenerated(questions,unit);
      setMessage("Generated "+questions.length+" questions from "+extracted.name+". They have been added to this practice session.");
    }catch(e){setError(e instanceof Error?e.message:"Question generation failed.");}
    finally{setBusy(false);}
  };
  return <section className="slide-generator">
    <div className="slide-generator-heading"><div><span className="eyebrow">{purpose==="flight"?"BUILD YOUR FLIGHT QUESTION SET":"CREATE QUESTIONS FROM YOUR LECTURES"}</span><h3>{purpose==="flight"?"Fly with your own lecture slides":"Upload slides and generate questions"}</h3><p>Use your current unit's lecture notes to create original practice questions with explanations.</p></div><span className="upload-icon">⇧</span></div>
    <div className="slide-generator-controls">
      <label>Clinical unit<select value={unit} onChange={e=>setUnit(e.target.value)}>{clinicalUnits.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <label>Number of questions<input type="number" min={1} max={50} value={count} onChange={e=>setCount(Math.max(1,Math.min(50,Number(e.target.value)||1)))}/></label>
      <label>Difficulty<select value={level} onChange={e=>setLevel(e.target.value)}><option>Mixed</option><option>Foundation</option><option>Clinical</option><option>Advanced</option></select></label>
    </div>
    <label className="slide-file-picker"><span>⇧</span><span><strong>{file?file.name:"Choose lecture slides or notes"}</strong><small>{file?(Math.round(file.size/1024)+" KB · ready to extract"):"PPTX, PDF, DOCX, TXT or Markdown · up to 20 MB"}</small></span><input type="file" accept=".pptx,.pdf,.docx,.txt,.md,.csv" onChange={e=>{setFile(e.target.files?.[0]||null);setError("");setMessage("");}}/></label>
    <div className="slide-generator-footer"><span>Slides are read in your browser; extracted text is sent to the authenticated AI service for question creation.</span><button className="primary-button" onClick={generate} disabled={busy||!file}>{busy?"Reading slides and creating questions…":"Generate questions"} <span>→</span></button></div>
    {sourceChars>0&&<p className="upload-meta">Read {sourceChars.toLocaleString()} characters from the selected file.</p>}
    {message&&<p className="success-note">{message}</p>}{error&&<p className="auth-error">{error}</p>}
  </section>;
}

function FlightGame() {
  const [started, setStarted] = useState(false);
  const [gameQuestions, setGameQuestions] = useState(flightQuestions);
  const [gameUnit, setGameUnit] = useState("general-medicine");
  const [gameOver, setGameOver] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [altitude, setAltitude] = useState(1000);
  const [bestAltitude, setBestAltitude] = useState(1000);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [lastOutcome, setLastOutcome] = useState<"correct" | "wrong" | null>(null);
  const [lastChange, setLastChange] = useState(0);
  const question = gameQuestions[questionIndex % gameQuestions.length];
  const progress = Math.max(0, Math.min(100, altitude / 3000 * 100));

  const startFlight = () => {
    setStarted(true); setGameOver(false); setQuestionIndex(0); setAltitude(1000);
    setCorrectCount(0); setStreak(0); setWrongAnswers(0); setSelected(null); setLastOutcome(null); setLastChange(0);
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
      const nextWrongAnswers = wrongAnswers + 1;
      const nextAltitude = nextWrongAnswers >= 4 ? 0 : Math.max(0, altitude - 300);
      setWrongAnswers(nextWrongAnswers); setAltitude(nextAltitude); setStreak(0);
      setLastOutcome("wrong"); setLastChange(-300);
      if (nextWrongAnswers >= 4) setGameOver(true);
    }
  };

  useEffect(() => {
    if (selected === null || gameOver) return;
    const timer = window.setTimeout(() => {
      setQuestionIndex(value => value + 1);
      setSelected(null); setLastOutcome(null); setLastChange(0);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [selected, gameOver]);

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
            {gameOver && <div className="flight-start-overlay"><div className="flight-start-icon">◈</div><strong>Flight failed — jet grounded</strong><p>You answered four questions incorrectly. Review the explanations and launch a new flight when ready.</p><button className="flight-launch-button" onClick={startFlight}>Restart flight <span>↻</span></button></div>}
          </div>
          <div className="flight-metrics"><div><span>QUESTIONS CORRECT</span><strong>{correctCount}</strong></div><div><span>WRONG ANSWERS LEFT</span><strong>{Math.max(0, 3 - wrongAnswers)}</strong></div><div><span>QUESTIONS ANSWERED</span><strong>{questionIndex + (selected !== null ? 1 : 0)}</strong></div></div>
        </div>

        <div className="flight-question-panel">
          <div className="question-topline"><span>MISSION {String(questionIndex + 1).padStart(2,"0")}</span><span>{question.topic}</span></div>
          <div className="question-progress"><span style={{width: (((questionIndex % gameQuestions.length) + 1) / gameQuestions.length * 100) + "%"}} /></div>
          <div className="question-difficulty">{question.difficulty} QUESTION</div>
          <h3>{started && !gameOver ? question.question : "Your next clinical question is cleared for take-off."}</h3>
          {started && !gameOver ? <div className="flight-options">{question.options.map((option,index) => <button key={option} className={"flight-option " + (selected === null ? "" : index === question.answer ? "option-correct" : index === selected ? "option-wrong" : "option-muted")} onClick={() => answerQuestion(index)} disabled={selected !== null}><span className="option-letter">{String.fromCharCode(65+index)}</span><span>{option}</span><span className="option-mark">{selected !== null && index === question.answer ? "✓" : selected === index ? "×" : "↗"}</span></button>)}</div> : <div className="flight-mission-placeholder"><span>✦</span><p>Choose an answer to climb. A wrong answer reduces your altitude. Keep your aircraft above ground level to continue.</p></div>}
          {selected !== null && lastOutcome && <div className={"flight-feedback " + lastOutcome}><strong>{lastOutcome === "correct" ? "Excellent — altitude gained!" : "Not quite — altitude lost."}</strong><p>{question.explanation}</p><div className="altitude-change">{lastChange > 0 ? "+" : ""}{lastChange.toLocaleString()} FT</div>{!gameOver && <div className="flight-auto-advance">Next question loading automatically…</div>}</div>}
          {!started && <div className="flight-howto"><span>HOW TO PLAY</span><p><b>Correct answer</b> <i>+</i> 250 ft altitude</p><p><b>Wrong answer</b> <i>−</i> 300 ft altitude</p></div>}
          {gameOver && <div className="flight-game-over-note"><strong>Flight summary</strong><p>You answered {correctCount} question{correctCount === 1 ? "" : "s"} correctly, made {wrongAnswers} incorrect attempt{wrongAnswers === 1 ? "" : "s"}, and reached {bestAltitude.toLocaleString()} ft.</p></div>}
        </div>
      </div>
      <div className="flight-quiz-footer"><span><i></i> CLINICAL LEARNING MODE · FOR EDUCATIONAL USE</span><span>QUESTION SET · {gameQuestions.length} QUESTIONS</span></div>
    </section>
  );
}

export default function Home() {
  const [active, setActive] = useState("overview");
  const [qbankUnit, setQbankUnit] = useState("general-medicine");
  const [qbankOrder, setQbankOrder] = useState(() => questionBank.map((q,i) => q.unit === "general-medicine" ? i : -1).filter(i => i >= 0));
  const [qbankIndex, setQbankIndex] = useState(0);
  const [qbankSelected, setQbankSelected] = useState<number | null>(null);
  const [guideUnit, setGuideUnit] = useState("general-medicine");
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [osceUnit, setOsceUnit] = useState("general-medicine");
  const [osceIndex, setOsceIndex] = useState(0);
  const [osceReveal, setOsceReveal] = useState(false);
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
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{navItems.find(x => x[1] === active)?.[0] || "Overview"}</strong></div><div className="top-actions"><a className="profile-top-link" href="/profile">My profile</a><span className="status-dot"></span><span className="saved-label">{authUser ? authUser.name : "Your workspace"}</span>{authUser ? <button className="help-button" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});window.location.reload();}}>↪</button> : <a className="sign-in-link" href="/login">Sign in</a>}<div className="avatar small-avatar">{authUser?.name?.[0] || "N"}</div></div></header>
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
          {active === "guides" && <><div className="page-intro"><div className="eyebrow">UNIT-BASED CLINICAL LEARNING</div><h1>Clinical clerking guides</h1><p>Choose your current rotation, then open a presentation guide for a structured history, examination, differential diagnosis and investigation approach.</p></div><div className="learning-toolbar"><label>My current unit<select value={guideUnit} onChange={e=>{setGuideUnit(e.target.value);setSelectedGuideId(null);}}>{clinicalUnits.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><p>{clinicalUnits.find(u=>u.id===guideUnit)?.topics}</p></div>{selectedGuideId ? (()=>{const g=caseGuides.find(x=>x.id===selectedGuideId); if(!g)return null; return <div className="guide-detail"><button className="text-link" onClick={()=>setSelectedGuideId(null)}>← Back to {clinicalUnits.find(u=>u.id===guideUnit)?.name} guides</button><div className="page-intro"><div className="eyebrow">{g.group.toUpperCase()} · CASE-BASED GUIDE</div><h1>How to clerk: {g.title}</h1><p>{g.intro}</p></div><div className="guide-section"><h3>1. Focused history — questions to ask</h3>{g.steps.map(([heading,body],i)=><div className="guide-step" key={heading}><strong>{String(i+1).padStart(2,"0")} · {heading}</strong><p>{body}</p></div>)}</div><div className="guide-section"><h3>2. Examination</h3><p>{g.exam}</p></div><div className="guide-section"><h3>3. Differential diagnosis</h3><p>{g.differentials}</p></div><div className="guide-section"><h3>4. Investigations and initial approach</h3><p>{g.workup}</p></div><div className="guide-section guide-pitfalls"><h3>5. Common omissions and safety points</h3><p>{g.pitfalls}</p></div><p className="guide-disclaimer">Educational framework only. Adapt to the patient, local protocols, available resources and senior clinical advice.</p></div>})() : <div className="guide-grid">{caseGuides.filter(g=>{const map:Record<string,string[]>={"general-medicine":["pain","fever","cough","abdominal-pain","headache","dyspnoea","vomiting","diarrhoea","seizure","weakness","jaundice","urinary"],"surgery":["pain","abdominal-pain","trauma","vomiting","jaundice"],"paediatrics":["pain","fever","cough","abdominal-pain","vomiting","diarrhoea","seizure","dyspnoea"],"obstetrics-gynaecology":["pain","fever","pv-bleeding","vaginal-discharge","headache","vomiting"],"emergency":["pain","fever","dyspnoea","seizure","trauma","weakness","vomiting"],"psychiatry":["headache","weakness"],"community-medicine":["fever","cough","diarrhoea","pain"],"orthopaedics":["pain","trauma","weakness"]};return (map[guideUnit]||[]).includes(g.id);}).map((g,i)=><button className="guide-card" key={g.id} onClick={()=>setSelectedGuideId(g.id)}><span className="resource-number">{String(i+1).padStart(2,"0")} · {g.group}</span><h3>{g.title}</h3><p>{g.intro}</p><span className="card-action">Open full clerking guide →</span></button>)}</div>}</>}
          {active === "osce" && <><div className="page-intro"><div className="eyebrow">PRACTICAL EXAM PREPARATION</div><h1>OSCE & Viva practice</h1><p>Use unit-specific clinical prompts to practise your reasoning and oral presentation.</p></div><div className="learning-toolbar"><label>Choose your unit<select value={osceUnit} onChange={e=>{setOsceUnit(e.target.value);setOsceIndex(0);setOsceReveal(false);}}>{clinicalUnits.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><p>Read the stem, formulate your answer aloud, then reveal the teaching points.</p></div>{(()=>{const qs=questionBank.filter(q=>q.unit===osceUnit);const q=qs[osceIndex%qs.length];return q?<div className="osce-card"><div className="question-topline"><span>VIVA STATION {String(osceIndex+1).padStart(2,"0")}</span><span>{q.topic} · {q.level}</span></div><h2>{q.q}</h2><p className="osce-instruction">Before revealing the answer, state your most likely answer and explain your clinical reasoning as if presenting to an examiner.</p><button className="primary-button" onClick={()=>setOsceReveal(v=>!v)}>{osceReveal?"Hide teaching points":"Reveal teaching points"} <span>→</span></button>{osceReveal&&<div className="guide-section"><h3>Examiner's teaching points</h3><p><strong>Best answer:</strong> {q.o[q.a]}</p><p>{q.e}</p></div>}<button className="secondary-button" onClick={()=>{setOsceIndex(i=>i+1);setOsceReveal(false);}}>Next viva prompt →</button></div>:<p>No prompts are available for this unit yet.</p>})()}</>}
          {active === "game" && <><div className="page-intro"><div className="eyebrow">TAKE A BREAK · TEST YOUR REFLEXES</div><h1>Flight simulator</h1><p>A continuous arcade flight challenge. Stay airborne for as long as you can.</p></div><FlightGame/></>}
          {active === "qbank" && <><div className="page-intro"><div className="eyebrow">UNIT-BASED ACTIVE RECALL</div><h1>Clinical question bank</h1><p>Select the unit you are currently posted to. Questions are shuffled into repeatable practice rounds, with explanations after every answer.</p></div><div className="learning-toolbar"><label>My current unit<select value={qbankUnit} onChange={e=>{const unit=e.target.value;setQbankUnit(unit);setQbankOrder(questionBank.map((q,i)=>q.unit===unit?i:-1).filter(i=>i>=0).sort(()=>Math.random()-.5));setQbankIndex(0);setQbankSelected(null);}}>{clinicalUnits.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><p>{clinicalUnits.find(u=>u.id===qbankUnit)?.topics}</p></div>{(()=>{const q=qbankOrder.length?questionBank[qbankOrder[qbankIndex%qbankOrder.length]]:null;return q?<div className="qbank-card"><div className="qbank-meta"><span>{q.topic}</span><span>{q.level} LEVEL</span><span>QUESTION {qbankIndex+1} / {qbankOrder.length}</span></div><div className="question-progress"><span style={{width:(((qbankIndex%qbankOrder.length)+1)/qbankOrder.length*100)+"%"}}/></div><h2>{q.q}</h2><div className="qbank-options">{q.o.map((option,i)=><button key={option} disabled={qbankSelected!==null} className={"qbank-option "+(qbankSelected===null?"":i===q.a?"option-correct":i===qbankSelected?"option-wrong":"option-muted")} onClick={()=>setQbankSelected(i)}><span>{String.fromCharCode(65+i)}</span>{option}<b>{qbankSelected!==null&&i===q.a?"✓":qbankSelected===i?"×":""}</b></button>)}</div>{qbankSelected!==null&&<div className={"qbank-explanation "+(qbankSelected===q.a?"is-correct":"is-wrong")}><strong>{qbankSelected===q.a?"Correct — well done.":"Review this concept."}</strong><p><b>Best answer: {q.o[q.a]}.</b> {q.e}</p></div>}<div className="qbank-actions"><span>{qbankSelected===null?"Select one best answer.":"Answer recorded for this practice question."}</span><button className="primary-button" disabled={qbankSelected===null} onClick={()=>{if(qbankIndex+1>=qbankOrder.length){setQbankOrder(questionBank.map((item,i)=>item.unit===qbankUnit?i:-1).filter(i=>i>=0).sort(()=>Math.random()-.5));setQbankIndex(0);}else setQbankIndex(i=>i+1);setQbankSelected(null);}}>{qbankIndex+1>=qbankOrder.length?"Start new shuffled round":"Next question"} <span>→</span></button></div><button className="text-link" onClick={()=>{setQbankOrder(questionBank.map((item,i)=>item.unit===qbankUnit?i:-1).filter(i=>i>=0).sort(()=>Math.random()-.5));setQbankIndex(0);setQbankSelected(null);}}>↻ Shuffle and restart this unit</button></div>:<p>No questions have been added for this unit yet.</p>})()}<p className="learning-note">Question sets are being expanded by unit. Repeated rounds reshuffle the available authored questions; clinical content is for education and should be checked against current local guidelines.</p></>}
        </div>
      </section>
    </main>
  );
}
