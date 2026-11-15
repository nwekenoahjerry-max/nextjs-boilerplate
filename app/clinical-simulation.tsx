"use client";

import { useEffect, useMemo, useState } from "react";
import { clinicalUnits } from "../lib/learning-content";

type Turn = { role:"assistant"|"user"; content:string };
type Material = { id:string; title:string; unit:string };
type SimulationResult = {
  caseTitle:string;
  patientBrief:string;
  stage:string;
  feedback:string;
  score:number;
  scoreLabel:string;
  strengths:string[];
  corrections:string[];
  clinicalReasoning:string;
  modelAnswer:string;
  nextQuestion:string;
  caseUpdate:string;
  safetyNote:string;
  isComplete:boolean;
};
type Intent = "answer"|"question";

export default function ClinicalSimulation() {
  const [unit,setUnit]=useState("general-medicine");
  const [materialId,setMaterialId]=useState("");
  const [materials,setMaterials]=useState<Material[]>([]);
  const [current,setCurrent]=useState<SimulationResult|null>(null);
  const [history,setHistory]=useState<Turn[]>([]);
  const [input,setInput]=useState("");
  const [intent,setIntent]=useState<Intent>("answer");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [showModelAnswer,setShowModelAnswer]=useState(false);
  const [turnCount,setTurnCount]=useState(0);

  const unitMaterials=useMemo(()=>materials.filter(item=>item.unit===unit),[materials,unit]);
  const unitName=clinicalUnits.find(item=>item.id===unit)?.name||unit;
  useEffect(()=>{
    fetch("/api/learning/materials",{credentials:"same-origin",cache:"no-store"})
      .then(async response=>{
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"Could not load your study library.");
        setMaterials(Array.isArray(data.materials)?data.materials:[]);
      }).catch(e=>setError(e instanceof Error?e.message:"Could not load study materials."));
  },[]);

  const runTurn=async (nextIntent:"start"|Intent,studentInput="")=>{
    setLoading(true);setError("");setShowModelAnswer(false);
    try{
      const conversationHistory:Turn[]=nextIntent==="start"
        ? []
        : [...history,{role:"user",content:studentInput}];
      const response=await fetch("/api/learning/simulate",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({
          unit,intent:nextIntent,studentInput,
          history:conversationHistory,
          materialId:materialId||undefined
        })
      });
      const data=await response.json().catch(()=>({error:"The simulation engine returned an unreadable response."}));
      if(!response.ok)throw new Error(data.error||"The simulation could not continue.");
      const next=data as SimulationResult;
      if(nextIntent==="start"){
        setHistory([{role:"assistant",content:JSON.stringify(next)}]);
        setTurnCount(0);
      }else{
        setHistory([...conversationHistory,{role:"assistant",content:JSON.stringify(next)}]);
        setTurnCount(value=>value+1);
      }
      setCurrent(next);
      setInput("");
    }catch(e){setError(e instanceof Error?e.message:"The simulation could not continue.");}
    finally{setLoading(false);}
  };

  const start=()=>runTurn("start");
  const submit=()=>{if(input.trim().length>=3)runTurn(intent,input.trim());};

  return <div className="clinical-simulation-workspace">
    <div className="page-intro">
      <div className="eyebrow">INTERACTIVE CASE-BASED LEARNING</div>
      <h1>Clinical simulation centre</h1>
      <p>Work through a fictional patient encounter in stages. ClerkMe responds to your clinical decisions, answers your questions and explains what you should improve.</p>
    </div>

    <section className="simulation-setup">
      <div className="simulation-setup-copy"><div className="eyebrow">PERSONALISE YOUR CASE</div><h2>Choose your clinical unit</h2><p>The case, examiner prompts and feedback are aligned to your current rotation.</p></div>
      <div className="simulation-setup-controls">
        <label>Clinical unit<select value={unit} onChange={event=>{setUnit(event.target.value);setMaterialId("");setCurrent(null);setHistory([]);setTurnCount(0);setInput("");setIntent("answer");setError("");}}>{clinicalUnits.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Study source (optional)<select value={materialId} onChange={event=>{setMaterialId(event.target.value);setCurrent(null);setHistory([]);setTurnCount(0);setInput("");setIntent("answer");setError("");}}><option value="">Use unit curriculum and general clinical knowledge</option>{unitMaterials.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      </div>
      <div className="simulation-setup-footer"><span>{unitMaterials.length} uploaded resource{unitMaterials.length===1?"":"s"} available in {unitName}</span><button className="text-link" onClick={()=>window.dispatchEvent(new CustomEvent("clerkme:navigate",{detail:{section:"materials"}}))}>Manage my materials ↗</button></div>
    </section>

    {!current ? <section className="simulation-empty">
      <div className="simulation-empty-icon">✚</div><h2>Your next patient is waiting</h2>
      <p>Start a new fictional case. ClerkMe will introduce the patient and give you one task at a time, just like a supervised clinical encounter.</p>
      <button className="primary-button" onClick={start} disabled={loading}>{loading?"Preparing your clinical case…":"Start a new simulation"} <span>→</span></button>
    </section> : <div className="simulation-active">
      <section className="simulation-case-card">
        <div className="simulation-case-top"><div><div className="eyebrow">{unitName.toUpperCase()} · FICTIONAL TEACHING CASE</div><h2>{current.caseTitle}</h2></div><span className="simulation-stage-pill">{current.stage}</span></div>
        <div className="simulation-patient-brief"><span className="simulation-patient-label">PATIENT BRIEF</span><p>{current.patientBrief}</p></div>
        {current.caseUpdate&&<div className="simulation-case-update"><strong>New information</strong><p>{current.caseUpdate}</p></div>}
        {current.safetyNote&&<div className="simulation-safety-note"><strong>Safety reminder</strong><p>{current.safetyNote}</p></div>}
        <div className="simulation-case-progress"><span>CASE PROGRESS</span><div><i style={{width:Math.min(100,15+turnCount*14)+"%"}}/></div><b>Stage {turnCount+1}</b></div>
      </section>

      <section className="simulation-interaction-card">
        <div className="eyebrow">YOUR NEXT TASK</div><h3>{current.nextQuestion}</h3>
        <div className="simulation-intent-switch">
          <button className={intent==="answer"?"active":""} onClick={()=>setIntent("answer")}>Respond to the case</button>
          <button className={intent==="question"?"active":""} onClick={()=>setIntent("question")}>Ask the simulator</button>
        </div>
        <label className="simulation-response-label">{intent==="answer"?"Your clinical response":"Your question for the tutor"}
          <textarea rows={5} value={input} onChange={event=>setInput(event.target.value)} placeholder={intent==="answer"?"Explain your next clinical step, relevant questions, examination, investigations or management reasoning…":"Ask why a finding matters, how to interpret a result or what a clinical term means…"} />
        </label>
        <div className="simulation-response-actions"><span>{intent==="answer"?"Explain your reasoning. ClerkMe will assess your answer and move the case forward.":"The simulator will answer your question and help you continue the case."}</span><button className="primary-button" onClick={submit} disabled={loading||input.trim().length<3}>{loading?"Reviewing your response…":intent==="answer"?"Submit clinical response":"Ask ClerkMe"} <span>→</span></button></div>
      </section>

      {current.feedback&&<section className="simulation-feedback-card">
        <div className="simulation-feedback-heading"><div><div className="eyebrow">EXAMINER FEEDBACK</div><h3>{current.scoreLabel}</h3></div>{current.score>0&&<div className="simulation-score"><strong>{current.score}</strong><span>/ 100</span></div>}</div>
        <p className="simulation-feedback-main">{current.feedback}</p>
        {!!current.strengths.length&&<div className="simulation-feedback-group positive"><strong>What you did well</strong><ul>{current.strengths.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}
        {!!current.corrections.length&&<div className="simulation-feedback-group corrections"><strong>What to improve or correct</strong><ul>{current.corrections.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}
        {current.clinicalReasoning&&<div className="simulation-reasoning"><strong>Clinical reasoning</strong><p>{current.clinicalReasoning}</p></div>}
        {current.modelAnswer&&<div className="simulation-model-answer"><button onClick={()=>setShowModelAnswer(value=>!value)}>{showModelAnswer?"Hide model answer":"Show model answer"} <span>{showModelAnswer?"−":"+"}</span></button>{showModelAnswer&&<p>{current.modelAnswer}</p>}</div>}
        {current.isComplete&&<div className="simulation-complete"><strong>Case completed</strong><p>You have reached the end of this case. Review your feedback or start another patient encounter.</p><button className="secondary-button" onClick={start} disabled={loading}>Start another case</button></div>}
      </section>}
      <div className="simulation-footer-actions"><button className="text-link" onClick={()=>{setCurrent(null);setHistory([]);setInput("");setError("");setTurnCount(0);}}>← End this case</button><button className="text-link" onClick={start} disabled={loading}>↻ Start a different case</button></div>
    </div>}
    {error&&<p className="auth-error simulation-error">{error}</p>}
    <p className="learning-note">Fictional educational simulation only. It is not a real patient consultation, autonomous diagnostic service or prescribing tool. Follow current local protocols and seek appropriate clinical supervision.</p>
  </div>;
}
