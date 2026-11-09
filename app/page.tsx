"use client";

import { useState } from "react";

const navItems = [
  ["Overview", "overview", "⌂"],
  ["New clerking", "clerking", "＋"],
  ["My patients", "patients", "▤"],
  ["Clinical guides", "guides", "✚"],
  ["OSCE & Viva", "osce", "◉"],
  ["Question bank", "qbank", "▦"],
];

const templates = [
  { title: "General medical clerking", detail: "Presenting complaint, HPC, PMH, drug and social history", tag: "MEDICINE", icon: "✚" },
  { title: "Paediatric clerking", detail: "Birth history, development, immunisation and nutrition", tag: "PAEDIATRICS", icon: "♧" },
  { title: "Obstetric history", detail: "Antenatal, intrapartum, gynaecological and obstetric history", tag: "OBSTETRICS", icon: "♡" },
  { title: "Surgical clerking", detail: "Surgical history, focused examination and peri-operative review", tag: "SURGERY", icon: "⌁" },
];

export default function Home() {
  const [active, setActive] = useState("overview");
  const [showNew, setShowNew] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [complaint, setComplaint] = useState("");
  const [saved, setSaved] = useState(false);

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
          <div className="profile"><div className="avatar">N</div><div><strong>Medical student</strong><small>Personal workspace</small></div><span className="profile-dots">•••</span></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{navItems.find(x => x[1] === active)?.[0] || "Overview"}</strong></div><div className="top-actions"><span className="status-dot"></span><span className="saved-label">Your workspace</span><button className="help-button" aria-label="Help">?</button><div className="avatar small-avatar">N</div></div></header>
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

          {active === "clerking" && <><div className="page-intro"><div className="eyebrow">PATIENT ASSESSMENT</div><h1>Clinical clerking</h1><p>Choose a structured template and organise your patient encounter.</p></div><div className="template-grid">{templates.map(t => <button className="template-card" key={t.title} onClick={() => { setShowNew(true); setSaved(false); }}><span className="template-icon large">{t.icon}</span><span className="template-tag">{t.tag}</span><h3>{t.title}</h3><p>{t.detail}</p><span className="card-action">Use template →</span></button>)}</div>{showNew && <div className="form-panel"><div className="panel-heading"><div><h3>Start a new patient clerking</h3><p>Use a study identifier. Avoid entering identifiable patient information into this demo.</p></div><button className="close-button" onClick={() => setShowNew(false)}>×</button></div><label>Patient study identifier<input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. Case 001"/></label><label>Presenting complaint<input value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="e.g. Fever for 5 days"/></label><button className="primary-button" onClick={() => setSaved(true)} disabled={!patientName.trim() || !complaint.trim()}>Create draft <span>→</span></button>{saved && <p className="success-note">Draft details captured in this page session. Persistent saving is not yet connected.</p>}</div>}</>}

          {active === "patients" && <div className="empty-state"><span className="empty-icon">▤</span><div className="eyebrow">CASE LIBRARY</div><h1>My patients</h1><p>Your saved case notes will appear here when secure storage is connected.</p><button className="primary-button" onClick={startClerking}>Start a clerking →</button><small>Demo version: no patient information is stored or transmitted.</small></div>}
          {active === "guides" && <><div className="page-intro"><div className="eyebrow">LEARN WITH STRUCTURE</div><h1>Clinical guides</h1><p>Quick-reference learning areas to support your clinical rotations.</p></div><div className="resource-grid">{["History taking & communication","General physical examination","Cardiovascular examination","Respiratory examination","Abdominal examination","Neurological examination","Paediatric assessment","Obstetric assessment"].map((x,i)=><div className="resource-card" key={x}><span className="resource-number">0{i+1}</span><h3>{x}</h3><p>Structured approach, key questions and examination checkpoints.</p><span className="coming-soon">LEARNING CONTENT COMING SOON</span></div>)}</div></>}
          {active === "osce" && <div className="empty-state"><span className="empty-icon">◉</span><div className="eyebrow">PRACTICAL EXAM PREPARATION</div><h1>OSCE & Viva practice</h1><p>Practise station structure, clinical presentation and viva-style questions.</p><div className="coming-soon large-label">PRACTICE MODULE IN DEVELOPMENT</div></div>}
          {active === "qbank" && <div className="empty-state"><span className="empty-icon">▦</span><div className="eyebrow">TEST YOUR KNOWLEDGE</div><h1>Clinical question bank</h1><p>Build confidence with topic-based questions, timed tests and explanations.</p><div className="coming-soon large-label">QUESTION BANK IN DEVELOPMENT</div></div>}
        </div>
      </section>
    </main>
  );
}
