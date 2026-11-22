"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clinicalUnits, questionBank } from "../lib/learning-content";
import { extractStudyFile } from "../lib/file-text";
import ClinicalGuides from "./clinical-guides";
import MaterialsPanel from "./materials-panel";
import VideoLibraryPanel from "./video-library-panel";
import AdaptiveFlightGame from "./adaptive-flight-game";
import LearningQuestionBank from "./learning-question-bank";
import ClinicalSimulation from "./clinical-simulation";
import InstallAppButton from "./install-app-button";
import ClerkMeBrand from "../components/clerkme-brand";
import { unitClerkingFrameworks } from "../lib/unit-clerking";

const navItems = [
  ["Overview", "overview", "⌂"],
  ["New clerking", "clerking", "＋"],
  ["My patients", "patients", "▤"],
  ["My materials", "materials", "▧"],
  ["Clinical guides", "guides", "✚"],
  ["Video library", "videos", "▶"],
  ["OSCE & Viva", "osce", "◉"],
  ["Clinical simulation", "simulation", "◉"],
  ["Question bank", "qbank", "▦"],
  ["Flight game", "game", "✈"],
  ["You", "you", "◉"],
];

const templates = [
  { id: "general-medicine", title: "General medical clerking", detail: "Presenting complaint, HPC, PMH, drug and social history", tag: "MEDICINE", icon: "✚" },
  { id: "paediatrics", title: "Paediatric clerking", detail: "Birth history, development, immunisation and nutrition", tag: "PAEDIATRICS", icon: "♧" },
  { id: "obstetrics-gynaecology", title: "Obstetric and gynaecological history", detail: "Antenatal, intrapartum, gynaecological and obstetric history", tag: "OBSTETRICS & GYNAECOLOGY", icon: "♡" },
  { id: "surgery", title: "Surgical clerking", detail: "Surgical history, examination and peri-operative review", tag: "SURGERY", icon: "⌁" },
];


const publicFeatureCards = [
  {number:"01",title:"Structured clinical clerking",description:"Work from biodata through presenting complaint, history, examination, assessment and case presentation.",detail:"A complete, guided workflow"},
  {number:"02",title:"Clinical guides",description:"Find specialty- and presenting-complaint-based questions, red flags and examination priorities.",detail:"Eight clinical units"},
  {number:"03",title:"Clinical simulation",description:"Practise patient interviews with interactive responses, optional voice exchange and examiner-style feedback.",detail:"Patient interview practice"},
  {number:"04",title:"OSCE and Viva",description:"Prepare for practical stations and oral examinations with focused prompts and teaching points.",detail:"Practical exam preparation"},
  {number:"05",title:"Question bank",description:"Revise with clinical questions organised by topic, unit and difficulty.",detail:"Active recall"},
  {number:"06",title:"Flight Academy",description:"Turn revision into a responsive question-led game with automatic progression and a three-failure limit.",detail:"Learn while you play"},
  {number:"07",title:"Your study materials",description:"Upload lecture notes and slides, build structured summaries and generate questions directly from your sources.",detail:"Your own lectures become practice"},
  {number:"08",title:"Private case library",description:"Keep your learning cases, clerking records and progress together in your personal workspace.",detail:"Account-protected workspace"},
];

function PublicLanding() {
  const [sampleAnswer, setSampleAnswer] = useState<number | null>(null);
  const sampleOptions = [
    "Ruptured ectopic pregnancy",
    "Threatened miscarriage",
    "Pelvic inflammatory disease",
    "Ovarian torsion",
  ];

  return (
    <main className="public-landing clerkme-public-home">
      <header className="public-header">
        <ClerkMeBrand caption="AI CLINICAL LEARNING & EXAM PREP" className="public-brand"/>
        <nav aria-label="Public navigation">
          <a href="#features">Explore features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="public-header-actions">
          <a className="public-header-signin" href="/login">Sign in <span>→</span></a>
          <a className="public-header-start" href="/login">Get started</a>
        </div>
      </header>

      <section className="public-hero">
        <div className="public-hero-copy">
          <span className="public-eyebrow"><i/> AI-POWERED LEARNING FOR MEDICAL STUDENTS</span>
          <h1>Make every lecture count.<br/><em>Walk into exams ready.</em></h1>
          <p>
            Turn your lecture materials into detailed study guides, high-quality SBAs and focused revision.
            Build clinical confidence with clerking, OSCE, Viva and interactive simulation — all in one workspace.
          </p>
          <div className="public-hero-actions">
            <a className="public-primary-cta" href="/login">Get started with ClerkME <span>→</span></a>
            <a className="public-secondary-cta" href="#features">Explore the study tools</a>
          </div>
          <div className="public-hero-proof" aria-label="ClerkME highlights">
            <div><strong>8</strong><span>clinical units</span></div>
            <div><strong>AI</strong><span>source-based study support</span></div>
            <div><strong>1</strong><span>connected learning space</span></div>
          </div>
        </div>

        <div className="public-hero-demo-wrap">
          <div className="public-demo-heading">
            <span>CLERKME QUICK PRACTICE</span>
            <strong>Try a sample SBA</strong>
          </div>
          <article className="public-demo-card" aria-label="Sample single-best-answer question">
            <div className="public-demo-top">
              <span className="public-demo-live"><i/> INTERACTIVE QUESTION</span>
              <span className="public-demo-no-login">No sign-in needed</span>
            </div>
            <div className="public-demo-meta">OBSTETRICS & GYNAECOLOGY <span>·</span> SINGLE BEST ANSWER</div>
            <h2>
              A 26-year-old woman presents with 7 weeks of amenorrhoea, lower abdominal pain and vaginal bleeding.
              She is dizzy and hypotensive. What is the most likely diagnosis?
            </h2>
            <div className="public-demo-options">
              {sampleOptions.map((option, index) => (
                <button
                  type="button"
                  key={option}
                  className={[
                    "public-demo-option",
                    sampleAnswer === index ? "is-selected" : "",
                    sampleAnswer !== null && index === 0 ? "is-correct" : "",
                    sampleAnswer !== null && sampleAnswer === index && index !== 0 ? "is-incorrect" : "",
                  ].filter(Boolean).join(" ")}
                  aria-pressed={sampleAnswer === index}
                  disabled={sampleAnswer !== null}
                  onClick={() => setSampleAnswer(index)}
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  <strong>{option}</strong>
                  <b>{sampleAnswer !== null && index === 0 ? "✓" : sampleAnswer === index && index !== 0 ? "×" : ""}</b>
                </button>
              ))}
            </div>
            {sampleAnswer !== null && (
              <div className={sampleAnswer === 0 ? "public-demo-feedback is-correct" : "public-demo-feedback is-review"} role="status">
                <strong>{sampleAnswer === 0 ? "Correct — well done." : "Not quite. Review the key clues."}</strong>
                <p>
                  Amenorrhoea, abdominal pain, vaginal bleeding and haemodynamic instability are red flags for a
                  ruptured ectopic pregnancy. This is a time-critical emergency requiring immediate resuscitation
                  and urgent senior/obstetric assessment.
                </p>
                <button type="button" onClick={() => setSampleAnswer(null)}>Try again <span>↻</span></button>
              </div>
            )}
            <div className="public-demo-footer">
              <span>ACTIVE RECALL</span>
              <span>LEARN · TEST · IMPROVE</span>
            </div>
          </article>
          <p className="public-demo-disclaimer">Example revision question for learning. ClerkME does not replace clinical judgement or supervision.</p>
        </div>
      </section>

      <section className="public-feature-section" id="features">
        <div className="public-section-heading">
          <div>
            <span className="public-eyebrow">YOUR CLINICAL LEARNING TOOLKIT</span>
            <h2>From lecture notes to confident clinical practice.</h2>
          </div>
          <p>Study from your own materials, strengthen your clinical reasoning and prepare for written and practical examinations.</p>
        </div>
        <div className="public-feature-grid">
          {publicFeatureCards.map(item => (
            <a className="public-feature-card" href="/login" key={item.number}>
              <span className="public-feature-number">{item.number}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <span className="public-feature-detail">{item.detail}</span>
              <b>Explore in your workspace <i>→</i></b>
            </a>
          ))}
        </div>
      </section>

      <section className="public-how-section" id="how-it-works">
        <div>
          <span className="public-eyebrow">A SIMPLE, CONNECTED WORKFLOW</span>
          <h2>Upload. Understand. Practise. Improve.</h2>
          <p>Bring your own lecture resources, build revision tools around them and practise the knowledge and skills you will need in examinations and clinical placements.</p>
        </div>
        <div className="public-how-steps">
          <div><span>01</span><strong>Bring your materials</strong><p>Upload supported lecture notes, PDFs and slide decks to your private study space.</p></div>
          <div><span>02</span><strong>Build your revision</strong><p>Create structured study guides and question sets based on your learning materials.</p></div>
          <div><span>03</span><strong>Practise and progress</strong><p>Use SBAs, OSCE, Viva and clinical simulation to strengthen recall and reasoning.</p></div>
        </div>
      </section>

      <section className="public-bottom-cta">
        <div>
          <span className="public-eyebrow">YOUR NEXT STUDY SESSION STARTS HERE</span>
          <h2>Prepare with purpose. Practise with confidence.</h2>
          <p>Sign in to open your ClerkME workspace and continue learning.</p>
        </div>
        <a className="public-primary-cta" href="/login">Enter ClerkME <span>→</span></a>
      </section>

      <footer className="public-footer" id="contact">
        <div className="public-footer-brand">
          <ClerkMeBrand caption="CLINICAL CLERKING & EXAM PREP"/>
          <span className="public-footer-copyright">© {new Date().getFullYear()} ClerkME</span>
        </div>
        <p className="public-footer-disclaimer">
          ClerkME is an educational learning companion. AI-generated content may contain errors and should be checked
          against original learning resources, current local guidance and clinical supervision. Do not upload identifiable patient information.
        </p>
        <div className="public-footer-contact">
          <strong>Contact</strong>
          <a href="https://wa.me/2349047324936" target="_blank" rel="noreferrer">WhatsApp · +234 904 732 4936</a>
          <a href="mailto:nwekenoahjerry@gmail.com">nwekenoahjerry@gmail.com</a>
          <small>Designed by Noah Chidindu Nweke</small>
        </div>
      </footer>
    </main>
  );
}
export default function Home() {
  const [active, setActive] = useState("overview");
  const [moreOpen, setMoreOpen] = useState(false);
  const selectSection = (id: string) => { setActive(id); setShowNew(id === "clerking"); setMoreOpen(false); };

  const [osceUnit, setOsceUnit] = useState("general-medicine");
  const [osceIndex, setOsceIndex] = useState(0);
  const [osceReveal, setOsceReveal] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [rawClerkingNotes,setRawClerkingNotes]=useState("");
  const [organisedClerkingProse,setOrganisedClerkingProse]=useState("");
  const [organiseLoading,setOrganiseLoading]=useState(false);
  const [organiseError,setOrganiseError]=useState("");
  const [copyNotice,setCopyNotice]=useState("");
  const [organiseMissing,setOrganiseMissing]=useState<string[]>([]);
  const [organiseUnclear,setOrganiseUnclear]=useState<string[]>([]);
  const [streakData,setStreakData]=useState<{today:string;streak:number;bestStreak:number;activeDays:number;todayActive:boolean;recentDates:string[]}>({today:"",streak:0,bestStreak:0,activeDays:0,todayActive:false,recentDates:[]});
  const [patientName, setPatientName] = useState("");
  const [complaint, setComplaint] = useState("");
  const [saved, setSaved] = useState(false);
  const [authUser, setAuthUser] = useState<{name:string;email:string;profileComplete:number}|null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const signOutTriggerRef = useRef<HTMLButtonElement>(null);
  const confirmSignOutButtonRef = useRef<HTMLButtonElement>(null);
  const [caseList, setCaseList] = useState<Array<{id:string;title:string;case_reference:string;specialty:string;presenting_complaint:string;status:string;updated_at:string}>>([]);
  const [saving, setSaving] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState("general-medicine");
  const clerkingFormRef = useRef<HTMLDivElement>(null);
  const selectedTemplate = templates.find(template => template.id === selectedSpecialty) || templates[0];
  const selectedTemplateFramework = unitClerkingFrameworks[selectedSpecialty];
  const learningWeek = useMemo(() => {
    if (!streakData.today) return [];
    const today = new Date(streakData.today + "T00:00:00Z");
    const monday = new Date(today);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const activeDates = new Set(streakData.recentDates || []);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return {
        key,
        label: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(date),
        active: activeDates.has(key),
        today: key === streakData.today
      };
    });
  }, [streakData.today, streakData.recentDates]);
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
  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me", {credentials:"same-origin",cache:"no-store"})
      .then(response => response.ok ? response.json() : null)
      .then(data => { if(mounted && data?.user) setAuthUser(data.user); })
      .catch(() => {})
      .finally(() => { if(mounted) setAuthLoading(false); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => { if(!authUser)return; fetch("/api/activity",{method:"POST",credentials:"same-origin"}).then(r=>r.ok?r.json():null).then(d=>{if(d)setStreakData(d);}).catch(()=>{}); },[authUser]);
  useEffect(() => {
    if (!showSignOutConfirm) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSignOutConfirm(false);
        setSignOutError("");
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    confirmSignOutButtonRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
      signOutTriggerRef.current?.focus();
    };
  }, [showSignOutConfirm]);

  const confirmSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Sign out could not be completed. Please try again.");
      window.location.assign("/login");
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Sign out could not be completed. Please try again.");
      setSigningOut(false);
    }
  };

  useEffect(() => {
    const navigate = (event: Event) => {
      const section = (event as CustomEvent<{section?: string}>).detail?.section;
      if (section && navItems.some(([, id]) => id === section)) {
        setActive(section);
        setShowNew(section === "clerking");
        setMoreOpen(false);
      }
    };
    window.addEventListener("clerkme:navigate", navigate);
    return () => window.removeEventListener("clerkme:navigate", navigate);
  }, []);
  const loadCases = async () => { const r = await fetch("/api/cases"); if (r.status === 401) { window.location.href = "/login"; return; } const d = await r.json(); if (r.ok) setCaseList(d.cases || []); else setApiError(d.error || "Could not load cases."); };
  useEffect(() => { if (active === "patients" && authUser) loadCases(); }, [active, authUser]);
  const saveCase = async () => { if (!authUser) { window.location.href = "/login"; return; } setSaving(true); setApiError(""); try { const r = await fetch("/api/cases", { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"same-origin", body:JSON.stringify({caseReference:patientName,title:"Clinical case " + patientName,presentingComplaint:complaint,specialty:selectedSpecialty,history:{historyOfPresentingComplaint:hpc,pastMedicalAndSurgicalHistory:pastHistory,medicationHistory:medications,allergies,familyHistory,socialHistory,reviewOfSystems:systemsReview,rawClerkingNotes,formattedProse:organisedClerkingProse},examination:{vitalSigns:vitals,findings:examination},assessment:{clinicalSummary:assessment,differentialDiagnoses:differentials},plan:{managementPlan:plan}}) }); const d=await r.json(); if (!r.ok) throw new Error(d.error || "Could not save case."); setSaved(true); setActive("patients"); await loadCases(); } catch(e) { setApiError(e instanceof Error ? e.message : "Could not save case."); } finally { setSaving(false); } };

  const resetClerkingDraft = () => {
    setPatientName("");
    setComplaint("");
    setRawClerkingNotes("");
    setOrganisedClerkingProse("");
    setOrganiseError("");
    setOrganiseMissing([]);
    setOrganiseUnclear([]);
    setHpc("");
    setPastHistory("");
    setMedications("");
    setAllergies("");
    setFamilyHistory("");
    setSocialHistory("");
    setSystemsReview("");
    setVitals("");
    setExamination("");
    setAssessment("");
    setDifferentials("");
    setPlan("");
    setApiError("");
    setCopyNotice("");
    setSaved(false);
  };

  const startClerking = (specialty = "general-medicine") => {
    resetClerkingDraft();
    setSelectedSpecialty(specialty);
    setActive("clerking");
    setShowNew(true);
    setMoreOpen(false);
  };

  useEffect(() => {
    if (active !== "clerking" || !showNew) return;
    const frame = window.requestAnimationFrame(() => {
      clerkingFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, showNew, selectedSpecialty]);
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

  const copyOrganisedProse = async () => {
    if (!organisedClerkingProse) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(organisedClerkingProse);
      setCopyNotice("Organised history copied to your clipboard.");
    } catch {
      window.prompt("Copy the organised clinical history below:", organisedClerkingProse);
      setCopyNotice("Use the copy prompt to copy your organised history.");
    }
  };

  if(authLoading) return <main className="public-loading"><ClerkMeBrand caption="CLINICAL LEARNING WORKSPACE" className="public-brand"/><span>Preparing your workspace…</span></main>;
  if(!authUser) return <PublicLanding/>;
  if(authUser.profileComplete !== 1) return <main className="profile-required-screen"><ClerkMeBrand caption="CLINICAL LEARNING WORKSPACE" className="public-brand"/><section><span className="eyebrow">ONE QUICK SETUP</span><h1>Complete your student profile</h1><p>Add your university, level and location to unlock your private learning workspace.</p><a className="primary-button" href="/profile?setup=1">Complete my profile <span>→</span></a></section></main>;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <ClerkMeBrand caption="CLINICAL COMPANION" href="#overview" className="workspace-brand" onClick={() => selectSection("overview")}/>
        <nav className="nav-list" aria-label="Workspace navigation">
          <div className="nav-section-label">WORKSPACE</div>
          {navItems.slice(0,5).map(([label, id, icon]) => (
            <button type="button" key={id} className={active === id ? "nav-item active" : "nav-item"} onClick={() => selectSection(id)} aria-current={active === id ? "page" : undefined}>
              <span className="nav-icon">{icon}</span><span className="nav-label">{label}</span>
              {id === "clerking" && <span className="nav-plus">+</span>}
            </button>
          ))}
          <div className="nav-section-label nav-section-spaced">LEARN & PRACTISE</div>
          {navItems.slice(5, 10).map(([label, id, icon]) => (
            <button type="button" key={id} className={active === id ? "nav-item active" : "nav-item"} onClick={() => selectSection(id)} aria-current={active === id ? "page" : undefined}>
              <span className="nav-icon">{icon}</span><span className="nav-label">{label}</span>
            </button>
          ))}
          <div className="nav-section-label nav-section-spaced">ACCOUNT</div>
          {navItems.slice(10).map(([label, id, icon]) => (
            <button type="button" key={id} className={active === id ? "nav-item active" : "nav-item"} onClick={() => selectSection(id)} aria-current={active === id ? "page" : undefined}>
              <span className="nav-icon">{icon}</span><span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card"><div className="upgrade-icon">◉</div><strong>Learn with confidence</strong><p>Build your clinical skills, one patient at a time.</p><button onClick={() => selectSection("guides")}>Explore guides <span>↗</span></button></div>
          <button type="button" className="profile profile-link sidebar-account-button" onClick={() => selectSection("you")}>
            <div className="avatar">{authUser?.name?.[0] || "C"}</div>
            <div><strong>{authUser?.name || "Medical student"}</strong><small>Account settings</small></div>
          </button>
        </div>
      </aside>

      <nav className="mobile-dock" aria-label="Main navigation">
        {navItems.filter(([,id])=>["overview","clerking","guides","patients"].includes(id)).map(([label,id,icon])=>(
          <button type="button" key={id} className={active===id?"mobile-dock-item active":"mobile-dock-item"} onClick={()=>selectSection(id)} aria-current={active===id?"page":undefined}>
            <span>{icon}</span><small>{id==="clerking"?"Clerk":id==="patients"?"Cases":id==="guides"?"Guides":label}</small>
          </button>
        ))}
        <button className={moreOpen||navItems.slice(0,5).every(([,id])=>id!==active)?"mobile-dock-item more-active":"mobile-dock-item"} onClick={()=>setMoreOpen(value=>!value)} aria-expanded={moreOpen}>
          <span>•••</span><small>More</small>
        </button>
      </nav>
      {moreOpen && <div className="mobile-more-scrim" onClick={()=>setMoreOpen(false)}>
        <div className="mobile-more-panel" onClick={event=>event.stopPropagation()}>
          <div className="mobile-more-heading"><div><strong>More from ClerkMe</strong><small>Study tools and your account</small></div><button onClick={()=>setMoreOpen(false)} aria-label="Close menu">×</button></div>
          {navItems.filter(([,id])=>id==="you").map(([label,id,icon])=>(
            <button key={id} className={active===id?"mobile-more-link active":"mobile-more-link"} onClick={()=>selectSection(id)}>
              <span>{icon}</span><strong>{label} · Your workspace</strong><b>→</b>
            </button>
          ))}
          {navItems.filter(([,id])=>!["overview","clerking","guides","patients","you"].includes(id)).map(([label,id,icon])=>(
            <button key={id} className={active===id?"mobile-more-link active":"mobile-more-link"} onClick={()=>selectSection(id)}>
              <span>{icon}</span><strong>{label}</strong><b>→</b>
            </button>
          ))}

        </div>
      </div>}

      <section className="main-area">
        <header className="topbar"><ClerkMeBrand href="#overview" className="mobile-brand" onClick={() => selectSection("overview")}/><div className="breadcrumb">Workspace <span>/</span> <strong>{navItems.find(x => x[1] === active)?.[0] || "Overview"}</strong></div><div className="top-actions"><button type="button" className="profile-top-link" onClick={() => setActive("you")}>You</button><span className="status-dot"></span><span className="saved-label">{authUser ? authUser.name : "Your workspace"}</span><div className="avatar small-avatar">{authUser?.name?.[0] || "C"}</div></div></header>
        <div className="content">
{active === "overview" && <>
            <div className="welcome-row dashboard-welcome">
              <div>
                <div className="eyebrow">YOUR CLINICAL WORKSPACE</div>
                <h1>Good to see you, {authUser?.name?.trim().split(/\s+/)[0] || "there"}.</h1>
                <p className="subheading">What would you like to work on today?</p>
              </div>
              <div className="date-chip"><span>●</span> Learn · Practise · Progress</div>
            </div>


            <section className="learning-rhythm" aria-label="Your learning activity">
              <div className="learning-rhythm-main">
                <div className="eyebrow">YOUR LEARNING RHYTHM</div>
                <h2>Consistency builds confidence.</h2>
                <p>{streakData.todayActive ? "You have checked in today. Keep the momentum going." : "Short, regular study sessions make it easier to retain what you learn."}</p>
                <div className="learning-rhythm-metrics">
                  <div><strong>{streakData.streak}</strong><span>Current streak</span></div>
                  <div><strong>{streakData.bestStreak}</strong><span>Personal best</span></div>
                  <div><strong>{streakData.activeDays}</strong><span>Days active</span></div>
                </div>
              </div>
              <div className="learning-week">
                <div className="learning-week-heading"><strong>This week</strong><span>Daily check-ins</span></div>
                <div className="learning-week-days">
                  {learningWeek.map(day => <div className={day.active ? "learning-week-day active" : day.today ? "learning-week-day today" : "learning-week-day"} key={day.key} aria-label={day.label + (day.active ? ", active" : ", no activity recorded")}>
                    <span>{day.label}</span><i>{day.active ? "✓" : "·"}</i>
                  </div>)}
                </div>
                <small className="learning-week-note">{streakData.todayActive ? "Today's learning activity is recorded." : "Your day is counted when you use ClerkMe."}</small>
              </div>
            </section>

            <section className="dashboard-hero" aria-label="Start a learning session">
              <div className="dashboard-hero-copy">
                <span className="hero-kicker">CLERK · LEARN · PRACTISE</span>
                <h2>Build clinical confidence,<br/>one focused session at a time.</h2>
                <p>Start a structured patient history, revisit a lecture or practise the clinical decisions that matter.</p>
                <div className="dashboard-hero-actions">
                  <button type="button" className="primary-button" onClick={() => startClerking()}>Start clinical clerking <span>→</span></button>
                  <button type="button" className="dashboard-hero-secondary" onClick={() => selectSection("materials")}>Study my lectures <span>↗</span></button>
                </div>
              </div>
              <div className="dashboard-hero-path" aria-label="Your learning cycle">
                <div className="dashboard-path-heading"><span>YOUR LEARNING CYCLE</span><b>01—04</b></div>
                <button type="button" className="dashboard-path-step" onClick={() => selectSection("materials")}><span>01</span><div><strong>Prepare</strong><small>Review a guide or lecture</small></div></button>
                <button type="button" className="dashboard-path-step" onClick={() => selectSection("clerking")}><span>02</span><div><strong>Practise</strong><small>Clerking, OSCE and viva</small></div></button>
                <button type="button" className="dashboard-path-step" onClick={() => selectSection("qbank")}><span>03</span><div><strong>Test yourself</strong><small>Questions and simulation</small></div></button>
                <button type="button" className="dashboard-path-step" onClick={() => selectSection("simulation")}><span>04</span><div><strong>Reflect</strong><small>Review and improve</small></div></button>
              </div>
            </section>


            <footer className="footer-note">ClerkMe is an educational learning companion. It supports learning and practice; it does not replace clinical supervision, current local protocols or professional judgement. Do not upload identifiable patient information.</footer>
          </>}

          {active === "you" && <>
            <div className="page-intro">
              <div className="eyebrow">ACCOUNT SETTINGS</div>
              <h1>You</h1>
              <p>Manage your ClerkME profile, app access and account security.</p>
            </div>

            <section className="panel you-account-panel">
              <div className="you-account-avatar">{authUser?.name?.[0] || "C"}</div>
              <div className="you-account-details">
                <span className="eyebrow">SIGNED IN AS</span>
                <strong>{authUser?.name || "Medical student"}</strong>
                <small>{authUser?.email || "Your ClerkME account"}</small>
              </div>
            </section>

            <section className="panel you-settings-panel">
              <div className="panel-heading">
                <div><h3>Account and settings</h3><p>Personal details, app access and sign-in security.</p></div>
              </div>
              <div className="you-settings-actions">
                <a className="you-setting-action" href="/profile">
                  <span className="template-icon">⚙</span>
                  <span><strong>Student profile</strong><small>Update your name, university, level, location and career interests.</small></span>
                  <span className="you-action-label">Edit profile</span>
                </a>
                <div className="you-setting-action">
                  <span className="template-icon">▣</span>
                  <span><strong>Install ClerkME</strong><small>Add the app to your device for quicker access to your workspace.</small></span>
                  <InstallAppButton/>
                </div>
                <button ref={signOutTriggerRef} type="button" className="you-setting-action" disabled={signingOut} onClick={() => { setSignOutError(""); setShowSignOutConfirm(true); }}>
                  <span className="template-icon">⏻</span>
                  <span><strong>Sign out</strong><small>Securely end your current ClerkME session on this device.</small></span>
                  <span className="you-action-label">Sign out</span>
                </button>
              </div>
            </section>
          </>}
          
{active === "clerking" && <><div className="page-intro"><div className="eyebrow">PATIENT ASSESSMENT</div><h1>Clinical clerking</h1><p>Choose a structured template and organise your patient encounter.</p></div><div className="template-grid">{templates.map(t => <article className={showNew && selectedSpecialty === t.id ? "template-card template-card-selected" : "template-card"} key={t.id}><span className="template-icon large">{t.icon}</span><span className="template-tag">{t.tag}</span><h3>{t.title}</h3><p>{t.detail}</p><button type="button" className="template-use-button" onClick={() => startClerking(t.id)}>{showNew && selectedSpecialty === t.id ? "Selected template ✓" : "Use template →"}</button></article>)}</div>{showNew && <div className="form-panel" ref={clerkingFormRef} tabIndex={-1}><div className="panel-heading"><div><span className="eyebrow">SELECTED TEMPLATE · {selectedTemplate.tag}</span><h3>{selectedTemplate.title}</h3><p>Use a non-identifying study reference. Do not enter patient names, hospital numbers or contact details.</p></div><button type="button" className="close-button" aria-label="Close clerking form" onClick={() => setShowNew(false)}>×</button></div>
            {selectedTemplateFramework && <div className="selected-template-context"><strong>{selectedTemplateFramework.title} focus</strong><p>{selectedTemplateFramework.overview}</p><div><span>Specialty-specific sections</span><ul>{selectedTemplateFramework.unitSections.map(section => <li key={section.title}>{section.title}</li>)}</ul></div></div>}
            <div className="clerking-note-panel"><div className="clerking-note-heading"><div><span className="eyebrow">CLERKING NOTE ORGANISER</span><h3>Organise rough notes into a clear clinical history</h3><p>Upload a document or paste your notes. ClerkMe will arrange the information you provide and identify details that still need to be checked.</p></div><span className="upload-icon">✎</span></div>
              <label className="slide-file-picker"><span>⇧</span><span><strong>Upload existing clerking notes</strong><small>DOCX, PDF, TXT or Markdown · remove names and hospital identifiers first</small></span><input type="file" accept=".docx,.pdf,.txt,.md" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setOrganiseError("");try{const extracted=await extractStudyFile(file);setRawClerkingNotes(extracted.text);}catch(err){setOrganiseError(err instanceof Error?err.message:"Could not read that file.");}}}/></label>
              <label>Paste or edit your raw clerking notes<textarea rows={7} value={rawClerkingNotes} onChange={e=>setRawClerkingNotes(e.target.value)} placeholder="Paste your rough notes here: presenting complaint, chronology, associated symptoms, relevant negatives, past history, medications, examination and assessment…"/></label>
              <button className="primary-button" onClick={organiseClerking} disabled={organiseLoading||rawClerkingNotes.trim().length<30}>{organiseLoading?"Organising your clerking…":"Organise into clinical prose"} <span>→</span></button>
              {organiseError&&<p className="auth-error">{organiseError}</p>}
              {organisedClerkingProse&&<div className="organised-prose"><div className="panel-heading"><h3>Organised clinical history</h3><button type="button" className="text-link" onClick={copyOrganisedProse}>Copy prose</button></div><pre>{organisedClerkingProse}</pre>{copyNotice&&<p className="copy-status" role="status">{copyNotice}</p>}{organiseMissing.length>0&&<div className="prose-followups"><strong>Information still to obtain</strong><ul>{organiseMissing.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}{organiseUnclear.length>0&&<div className="prose-followups"><strong>Unclear or conflicting details to verify</strong><ul>{organiseUnclear.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}<small>Check every sentence against the original notes before using or saving this write-up. ClerkMe does not add missing clinical facts.</small></div>}
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

          {active === "patients" && <><div className="page-intro"><div className="eyebrow">PRIVATE CASE LIBRARY</div><h1>My cases</h1><p>Cases are visible only to the account that created them.</p></div><button className="primary-button" onClick={loadCases}>Refresh cases</button>{!authUser ? <div className="empty-state"><p>Sign in to view your saved cases.</p><a className="sign-in-link" href="/login">Sign in with Google</a></div> : <div className="panel case-library">{caseList.length ? caseList.map(c=><div className="template-row" key={c.id}><span className="template-icon">▤</span><span className="template-info"><strong>{c.title} · {c.case_reference}</strong><small>{c.specialty} · {c.presenting_complaint}</small></span><span className="template-tag">{c.status}</span></div>) : <div className="empty-state"><p>No saved cases yet. Start your first clerking.</p><button className="primary-button" onClick={() => startClerking()}>Start a clerking →</button></div>}</div>}</> }
          {active === "guides" && <ClinicalGuides/>}
          {active === "materials" && <MaterialsPanel/>}
          {active === "videos" && <VideoLibraryPanel/>}
          {active === "osce" && <><div className="page-intro"><div className="eyebrow">PRACTICAL EXAM PREPARATION</div><h1>OSCE & Viva practice</h1><p>Use unit-specific clinical prompts to practise your reasoning and oral presentation.</p></div><div className="learning-toolbar"><label>Choose your unit<select value={osceUnit} onChange={e=>{setOsceUnit(e.target.value);setOsceIndex(0);setOsceReveal(false);}}>{clinicalUnits.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><p>Read the stem, formulate your answer aloud, then reveal the teaching points.</p></div>{(()=>{const qs=questionBank.filter(q=>q.unit===osceUnit);const q=qs[osceIndex%qs.length];return q?<div className="osce-card"><div className="question-topline"><span>VIVA STATION {String(osceIndex+1).padStart(2,"0")}</span><span>{q.topic} · {q.level}</span></div><h2>{q.q}</h2><p className="osce-instruction">Before revealing the answer, state your most likely answer and explain your clinical reasoning as if presenting to an examiner.</p><button className="primary-button" onClick={()=>setOsceReveal(v=>!v)}>{osceReveal?"Hide teaching points":"Reveal teaching points"} <span>→</span></button>{osceReveal&&<div className="guide-section"><h3>Examiner's teaching points</h3><p><strong>Best answer:</strong> {q.o[q.a]}</p><p>{q.e}</p></div>}<button className="secondary-button" onClick={()=>{setOsceIndex(i=>i+1);setOsceReveal(false);}}>Next viva prompt →</button></div>:<p>No prompts are available for this unit yet.</p>})()}</>}
          {active === "game" && <><div className="page-intro"><div className="eyebrow">UNIT- AND MATERIAL-ADAPTIVE LEARNING</div><h1>Flight simulator</h1><p>Practise with questions from your current unit and the lecture materials you have uploaded.</p></div><AdaptiveFlightGame onOpenMaterials={()=>setActive("materials")}/></>}
          {active === "simulation" && <ClinicalSimulation/>}
          {active === "qbank" && <LearningQuestionBank/>}
        </div>
      </section>
      {showSignOutConfirm && (
        <div
          className="signout-confirm-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !signingOut) {
              setShowSignOutConfirm(false);
              setSignOutError("");
            }
          }}
        >
          <section
            className="signout-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="signout-confirm-title"
            aria-describedby="signout-confirm-description"
          >
            <div className="signout-confirm-icon" aria-hidden="true">⏻</div>
            <span className="eyebrow">ACCOUNT</span>
            <h2 id="signout-confirm-title">Do you want to sign out?</h2>
            <p id="signout-confirm-description">You will need to sign in again to access your ClerkME workspace and saved learning materials.</p>
            {signOutError && <p className="signout-confirm-error" role="alert">{signOutError}</p>}
            <div className="signout-confirm-actions">
              <button
                type="button"
                className="signout-cancel-button"
                disabled={signingOut}
                onClick={() => { setShowSignOutConfirm(false); setSignOutError(""); }}
              >
                Cancel
              </button>
              <button
                ref={confirmSignOutButtonRef}
                type="button"
                className="signout-accept-button"
                disabled={signingOut}
                onClick={confirmSignOut}
              >
                {signingOut ? "Signing out…" : "Yes, sign out"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
