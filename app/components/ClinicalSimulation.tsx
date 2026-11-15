"use client";

import { useMemo, useState, type FormEvent } from "react";

type Scenario = { id: string; unit: string; title: string; level: string; opening: string; profile: string };
type Message = { role: "student" | "patient"; content: string };

const scenarios: Scenario[] = [
  { id: "cough", unit: "general-medicine", title: "Persistent cough", level: "Core clinical", opening: "Doctor, I have been coughing for about three weeks now. It is not getting better.", profile: "You are Mr B, a 34-year-old motor mechanic. Cough for three weeks, productive of yellow sputum with one episode of blood streaking. Night sweats, fever at night and about 8 kg weight loss. No chest pain. Your elder brother lived in the same room, coughed for months and died last year. You have never had an HIV test and have no known diabetes or asthma. Amoxicillin and an herbal mixture did not help. You smoke five cigarettes daily, drink beer at weekends and six people live in a two-room apartment. Answer as the patient in first person. Disclose only facts relevant to the question. Do not volunteer a diagnosis." },
  { id: "abdomen", unit: "surgery", title: "Acute abdominal pain", level: "Core clinical", opening: "Doctor, my stomach has been hurting badly for two days, and I have vomited.", profile: "You are C, a 22-year-old university student. Abdominal pain began around the umbilicus two days ago, then moved to the right lower abdomen and became sharp. You vomited three times, have fever and loss of appetite; coughing worsens the pain. No previous surgery or known peptic ulcer. You took paracetamol and diclofenac. You have not eaten since the pain began. Answer as the patient. Do not volunteer a diagnosis or investigation result." },
  { id: "child", unit: "paediatrics", title: "Child with fever and a fit", level: "Intermediate", opening: "Doctor, my two-year-old son has had a fever for three days. He had a fit this morning.", profile: "You are the mother of a two-year-old boy. Fever for three days, vomiting, two generalised convulsions today each around ten minutes. Child is very weak and urine is dark. No cough; mother reports no neck stiffness. You gave paracetamol and an herbal mixture; a chemist administered an injection. Routine vaccines reportedly complete and card is available. Breastfed until one year, now eats family food but has refused food for two days. No mosquito net; nearby open gutter; elder sister had malaria last month. Answer as the mother, not as a clinician. Do not state a diagnosis." },
  { id: "pregnancy", unit: "obstetrics-gynaecology", title: "Bleeding in pregnancy", level: "Advanced", opening: "Doctor, I am pregnant and I noticed blood coming out this morning. I am frightened.", profile: "You are a 29-year-old woman, G2P1, estimated 30 weeks pregnant by an early scan. Painless fresh vaginal bleeding began this morning, moderate amount, no clots. Fetal movements are present. No abdominal pain, contractions, fluid leakage, headache or visual symptoms. One previous uncomplicated vaginal delivery at term. Attended antenatal clinic regularly. Blood group is unknown to you. You are anxious and worried about the baby. Answer in first person. Do not volunteer a diagnosis or management plan." },
  { id: "psychiatry", unit: "psychiatry", title: "Hearing voices", level: "Intermediate", opening: "Doctor, my brother brought me here because he says I have been acting strangely.", profile: "You are a 26-year-old graduate, currently unemployed. For about three months you have heard voices commenting on your actions and believe neighbours are plotting to poison your food. You sleep poorly and have reduced self-care and appetite. You deny thoughts of suicide and have not been violent. You used cannabis at university but stopped two years ago. This is your first episode. No known head injury or seizures. Your brother lives with you and can provide collateral history. Respond as the patient and do not reveal a diagnosis." },
  { id: "trauma", unit: "emergency", title: "Road traffic injury", level: "Advanced", opening: "Doctor, I was involved in a road accident about an hour ago. My chest and right leg hurt.", profile: "You are a 31-year-old man, motorcycle passenger, collision one hour ago. You were not wearing a helmet. No loss of consciousness and you remember the event. Right-sided chest pain worsens with deep breaths; right lower-leg pain and swelling; no obvious external bleeding. You vomited once after the accident. No known anticoagulant use or drug allergy; last ate four hours before the crash. Answer only as the patient; do not provide examination findings or diagnosis." },
  { id: "knee", unit: "orthopaedics", title: "Painful swollen knee", level: "Core clinical", opening: "Doctor, my right knee has been painful and swollen since yesterday.", profile: "You are a 48-year-old trader with sudden right knee pain and swelling beginning yesterday. No major trauma. Pain is severe on movement and weight bearing. The knee feels warm. No similar episode previously. You have hypertension and take an antihypertensive tablet but cannot recall its name. No known drug allergies and no fever reported. Answer as the patient and do not reveal a diagnosis." }
];

export default function ClinicalSimulation({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [caseId, setCaseId] = useState(scenarios[0].id);
  const [messages, setMessages] = useState<Message[]>([{ role: "patient", content: scenarios[0].opening }]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scenario = useMemo(() => scenarios.find(item => item.id === caseId) || scenarios[0], [caseId]);

  const chooseCase = (id: string) => {
    const next = scenarios.find(item => item.id === id) || scenarios[0];
    setCaseId(next.id); setMessages([{ role: "patient", content: next.opening }]); setQuestion(""); setError("");
  };

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy) return;
    if (!isAuthenticated) { setError("Sign in to use the patient simulator."); return; }
    const history = messages.slice(-12);
    setMessages(current => [...current, { role: "student", content: prompt }]);
    setQuestion(""); setBusy(true); setError("");
    try {
      const response = await fetch("/api/learning/simulate", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ unit: scenario.unit, scenarioTitle: scenario.title, scenarioProfile: scenario.profile, conversation: history, question: prompt })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The simulated patient could not respond.");
      setMessages(current => [...current, { role: "patient", content: String(data.reply || "I am not sure how to answer that.") }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The simulated patient could not respond.");
      setMessages(current => current.filter((item, index) => !(index === current.length - 1 && item.role === "student" && item.content === prompt)));
    } finally { setBusy(false); }
  };

  return <section className="clinical-simulation">
    <div className="simulation-heading"><div><span className="eyebrow">INTERACTIVE HISTORY-TAKING PRACTICE</span><h1>Clinical patient simulation</h1><p>Interview a standardised AI patient. Ask naturally, one question at a time, and receive contextual replies as the patient.</p></div><span className="simulation-status">● LIVE PRACTICE</span></div>
    <div className="simulation-layout">
      <aside className="simulation-case-picker"><span className="study-section-kicker">CHOOSE A SCENARIO</span><label>Clinical case<select value={caseId} onChange={event => chooseCase(event.target.value)}>{scenarios.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="simulation-case-meta"><span>{scenario.unit.replaceAll("-", " ").toUpperCase()}</span><strong>{scenario.level}</strong></div><div className="simulation-case-intro"><strong>Opening statement</strong><p>{scenario.opening}</p></div><button type="button" className="secondary-button" onClick={() => chooseCase(caseId)}>Restart interview ↻</button><div className="simulation-tip"><strong>Interview technique</strong><p>Begin with an open question. Explore chronology, associated symptoms, relevant negatives, risk factors and the patient's ideas and concerns. Summarise before forming a differential.</p></div></aside>
      <div className="simulation-chat-panel"><div className="simulation-chat-top"><div><strong>Standardised patient</strong><span>Role-play · {scenario.title}</span></div><span className="simulation-live-dot">PATIENT ACTIVE</span></div><div className="simulation-transcript" aria-live="polite">{messages.map((message, index) => <article className={"simulation-message " + message.role} key={index}><span>{message.role === "student" ? "YOU" : "PATIENT"}</span><p>{message.content}</p></article>)}{busy && <article className="simulation-message patient"><span>PATIENT</span><p className="study-thinking">Thinking about your question…</p></article>}</div>
        <form className="simulation-question-form" onSubmit={send}><label htmlFor="simulation-question">Ask the patient</label><textarea id="simulation-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="e.g. When did the cough begin? Is it associated with fever or weight loss?" rows={3} maxLength={900} disabled={!isAuthenticated || busy}/><div><span>{isAuthenticated ? "Ask one clear question at a time." : <>Sign in to start. <a href="/login">Sign in with Google</a>.</>}</span><button className="primary-button" type="submit" disabled={!isAuthenticated || busy || !question.trim()}>Ask patient <span>→</span></button></div></form>{error && <p className="auth-error" role="alert">{error}</p>}
      </div>
    </div>
    <p className="simulation-disclaimer">Educational role-play only. This is not a real patient encounter and does not replace supervised clinical practice.</p>
  </section>;
}
