"use client";

import { useEffect, useMemo, useState } from "react";
import { clinicalUnits, questionBank } from "../lib/learning-content";

type GeneratedQuestion = {
  question:string; options:string[]; answerIndex:number; explanation:string; topic:string; difficulty:string;
};
type StudyMaterial = { id:string;title:string;unit:string;questions:GeneratedQuestion[] };

export default function LearningQuestionBank() {
  const [unit,setUnit]=useState("general-medicine");
  const [materials,setMaterials]=useState<StudyMaterial[]>([]);
  const [index,setIndex]=useState(0);
  const [selected,setSelected]=useState<number|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [showSource,setShowSource]=useState(true);

  const load=async()=>{
    const response=await fetch("/api/learning/materials",{credentials:"same-origin",cache:"no-store"});
    const data=await response.json().catch(()=>({error:"Could not read your study library."}));
    if(!response.ok)throw new Error(data.error||"Sign in to access your study materials.");
    setMaterials(Array.isArray(data.materials)?data.materials:[]);
  };
  useEffect(()=>{load().catch(e=>setError(e instanceof Error?e.message:"Could not load your materials.")).finally(()=>setLoading(false));},[]);

  const uploaded=useMemo(()=>materials.filter(item=>item.unit===unit).flatMap(item=>(item.questions||[]).map((q,i)=>({
    ...q,id:item.id+"-"+i,source:item.title,origin:"uploaded" as const
  }))),[materials,unit]);
  const builtIn=useMemo(()=> (questionBank as unknown as Array<{id:string;unit:string;topic:string;level:string;q:string;o:string[];a:number;e:string}>)
    .filter(item=>item.unit===unit).map(item=>({
      question:item.q,options:item.o,answerIndex:item.a,explanation:item.e,topic:item.topic,difficulty:item.level,id:item.id,source:"ClerkMe core bank",origin:"core" as const
    })),[unit]);
  const questions=uploaded.length?uploaded:builtIn;
  const q=questions.length?questions[index%questions.length]:null;

  const chooseUnit=(value:string)=>{setUnit(value);setIndex(0);setSelected(null);setError("");};
  const next=()=>{if(!questions.length)return;setIndex(v=>(v+1)%questions.length);setSelected(null);};
  const shuffle=()=>{setIndex(questions.length>1?Math.floor(Math.random()*questions.length):0);setSelected(null);};

  return <div className="question-bank-workspace">
    <div className="page-intro"><div className="eyebrow">ACTIVE RECALL · SOURCE-ALIGNED PRACTICE</div><h1>Clinical question bank</h1><p>Questions adapt to your selected clinical unit. When you have generated questions from uploaded lecture material, those take priority over the core set.</p></div>
    <div className="learning-toolbar">
      <label>My current unit<select value={unit} onChange={event=>chooseUnit(event.target.value)}>{clinicalUnits.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <p>{uploaded.length?(`${uploaded.length} question(s) from your uploaded materials`):(`${builtIn.length} core questions available for this unit`)}</p>
    </div>
    <div className="question-bank-source-banner">
      <div><strong>{uploaded.length?"Your uploaded materials are driving this question set.":"No uploaded question set is available for this unit yet."}</strong><span>{uploaded.length?"Review the source material alongside each explanation.":"Use My Materials to upload lecture notes and generate a personalised question bank."}</span></div>
      <button className="secondary-button" onClick={()=>window.dispatchEvent(new CustomEvent("clerkme:navigate",{detail:{section:"materials"}}))}>Open my materials ↗</button>
    </div>
    {error&&<p className="auth-error">{error}</p>}
    {loading?<div className="materials-empty"><strong>Loading your question set…</strong></div>:
      q?<div className="qbank-card">
        <div className="qbank-meta"><span>{q.topic}</span><span>{q.difficulty} LEVEL</span><span>QUESTION {index+1} / {questions.length}</span></div>
        <div className="question-progress"><span style={{width:((index%questions.length+1)/questions.length*100)+"%"}}/></div>
        <h2>{q.question}</h2>
        <div className="qbank-options">{q.options.map((option,i)=><button key={option+i} disabled={selected!==null} className={"qbank-option "+(selected===null?"":i===q.answerIndex?"option-correct":i===selected?"option-wrong":"option-muted")} onClick={()=>{setSelected(i);fetch("/api/activity",{method:"POST",credentials:"same-origin"}).catch(()=>{});}}><span>{String.fromCharCode(65+i)}</span>{option}<b>{selected!==null&&i===q.answerIndex?"✓":selected===i?"×":""}</b></button>)}</div>
        {selected!==null&&<div className={"qbank-explanation "+(selected===q.answerIndex?"is-correct":"is-wrong")}><strong>{selected===q.answerIndex?"Correct — well done.":"Review this concept."}</strong><p><b>Best answer: {q.options[q.answerIndex]}.</b> {q.explanation}</p></div>}
        <div className="qbank-actions"><span>{q.source} · {selected===null?"Select one best answer.":"Answer recorded for this practice question."}</span><button className="primary-button" disabled={selected===null} onClick={next}>Next question <span>→</span></button></div>
        <button className="text-link" onClick={shuffle}>↻ Jump to another question</button>
      </div>:<div className="empty-state"><p>No questions have been added for {clinicalUnits.find(item=>item.id===unit)?.name} yet.</p><button className="primary-button" onClick={()=>window.dispatchEvent(new CustomEvent("clerkme:navigate",{detail:{section:"materials"}}))}>Upload a lecture to begin →</button></div>}
    <p className="learning-note">Questions generated from uploaded documents should be checked against the original source and current local guidance. A generated question is a learning aid, not an authoritative clinical protocol.</p>
  </div>;
}
