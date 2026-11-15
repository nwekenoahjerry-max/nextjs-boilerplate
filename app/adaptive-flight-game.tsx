"use client";

import { useEffect, useMemo, useState } from "react";
import { clinicalUnits, questionBank } from "../lib/learning-content";

type GeneratedQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  topic: string;
  difficulty: string;
};
type StudyMaterial = {
  id: string;
  title: string;
  unit: string;
  questions: GeneratedQuestion[];
};

const fallbackQuestions = questionBank as unknown as Array<{
  id:string;unit:string;topic:string;level:string;q:string;o:string[];a:number;e:string;
}>;

export default function AdaptiveFlightGame({ onOpenMaterials }: { onOpenMaterials:()=>void }) {
  const [materials,setMaterials] = useState<StudyMaterial[]>([]);
  const [unit,setUnit] = useState("general-medicine");
  const [materialId,setMaterialId] = useState("all");
  const [loading,setLoading] = useState(true);
  const [generating,setGenerating] = useState(false);
  const [error,setError] = useState("");
  const [started,setStarted] = useState(false);
  const [index,setIndex] = useState(0);
  const [selected,setSelected] = useState<number|null>(null);
  const [altitude,setAltitude] = useState(1000);
  const [bestAltitude,setBestAltitude] = useState(1000);
  const [correct,setCorrect] = useState(0);
  const [wrong,setWrong] = useState(0);
  const [streak,setStreak] = useState(0);
  const [gameOver,setGameOver] = useState(false);

  const reload = async () => {
    const response = await fetch("/api/learning/materials",{credentials:"same-origin",cache:"no-store"});
    const data = await response.json().catch(()=>({error:"Could not read your study library."}));
    if (!response.ok) throw new Error(data.error||"Sign in to use your private study materials.");
    setMaterials(Array.isArray(data.materials)?data.materials:[]);
  };
  useEffect(()=>{
    reload().catch(e=>setError(e instanceof Error?e.message:"Could not load your study library.")).finally(()=>setLoading(false));
  },[]);

  const unitMaterials = useMemo(()=>materials.filter(item=>item.unit===unit),[materials,unit]);
  const chosenMaterial = unitMaterials.find(item=>item.id===materialId);
  const uploadedQuestions = useMemo(()=>{
    const rows = materialId==="all" ? unitMaterials : chosenMaterial?[chosenMaterial]:[];
    return rows.flatMap(item=>(item.questions||[]).map((q,i)=>({...q,id:item.id+"-"+i,source:item.title})));
  },[unitMaterials,chosenMaterial,materialId]);
  const builtInQuestions = useMemo(()=>fallbackQuestions.filter(item=>item.unit===unit),[unit]);
  const activeQuestions = uploadedQuestions.length ? uploadedQuestions : builtInQuestions.map(item=>({
    question:item.q,options:item.o,answerIndex:item.a,explanation:item.e,topic:item.topic,difficulty:item.level,source:"ClerkMe core bank",id:item.id
  }));
  const question = activeQuestions.length ? activeQuestions[index%activeQuestions.length] : null;
  const selectedMaterialNeedsQuestions = !!chosenMaterial && !(chosenMaterial.questions||[]).length;

  const reset = () => {
    setStarted(true);setIndex(0);setSelected(null);setAltitude(1000);setCorrect(0);setWrong(0);setStreak(0);setGameOver(false);
  };
  const changeUnit = (value:string) => {
    setUnit(value);setMaterialId("all");setStarted(false);setIndex(0);setSelected(null);setGameOver(false);
  };
  const generateForSelected = async () => {
    if (!chosenMaterial) return;
    setGenerating(true);setError("");
    try {
      const response=await fetch("/api/learning/generate",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({materialId:chosenMaterial.id,count:25,level:"Mixed"})
      });
      const data=await response.json().catch(()=>({error:"The AI service returned an unreadable response."}));
      if(!response.ok) throw new Error(data.error||"Could not create questions from this material.");
      await reload();setStarted(false);setIndex(0);setSelected(null);
    } catch(e) { setError(e instanceof Error?e.message:"Question generation failed."); }
    finally { setGenerating(false); }
  };
  const answerQuestion = (option:number) => {
    if(selected!==null||!question||gameOver) return;
    setSelected(option);
    void fetch("/api/activity",{method:"POST",credentials:"same-origin"}).catch(()=>{});
    if(option===question.answerIndex) {
      setAltitude(value=>value+250);setBestAltitude(value=>Math.max(value,altitude+250));setCorrect(value=>value+1);setStreak(value=>value+1);
    } else {
      const nextWrong=wrong+1;setWrong(nextWrong);setStreak(0);
      if(nextWrong>=4) setGameOver(true);
      setAltitude(value=>Math.max(0,nextWrong>=4?0:value-300));
    }
  };
  useEffect(()=>{
    if(selected===null||gameOver)return;
    const timer=window.setTimeout(()=>{
      setIndex(value=>value+1);setSelected(null);
    },2100);
    return ()=>window.clearTimeout(timer);
  },[selected,gameOver]);

  return <section className="flight-quiz">
    <div className="flight-quiz-heading">
      <div><span className="eyebrow">UNIT-BASED CLINICAL GAME</span><h2>Skyward <span>Flight Academy</span></h2><p>Your selected unit and uploaded lecture materials determine the questions you fly with.</p></div>
      <div className="flight-best"><span>PERSONAL BEST</span><strong>{bestAltitude.toLocaleString()} <small>FT</small></strong></div>
    </div>
    <div className="flight-source-controls">
      <label>Clinical unit<select value={unit} onChange={event=>changeUnit(event.target.value)}>{clinicalUnits.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Question source<select value={materialId} onChange={event=>{setMaterialId(event.target.value);setStarted(false);setIndex(0);setSelected(null);}}><option value="all">All my uploaded materials for this unit</option>{unitMaterials.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    </div>
    <div className="flight-source-summary">
      {loading?"Loading your private study library…":uploadedQuestions.length>0
        ? <span><strong>{uploadedQuestions.length} uploaded-material questions</strong> · {unitMaterials.length} resource{unitMaterials.length===1?"":"s"} in {clinicalUnits.find(item=>item.id===unit)?.name}</span>
        : <span><strong>{builtInQuestions.length} core questions</strong> · {unitMaterials.length? "Your uploaded materials have not generated questions yet.":"Upload notes to personalise the game."}</span>}
      <button className="text-link" onClick={onOpenMaterials}>Manage study materials ↗</button>
    </div>
    {selectedMaterialNeedsQuestions&&<div className="flight-material-prompt"><span>This material has no question set yet.</span><button className="secondary-button" onClick={generateForSelected} disabled={generating}>{generating?"Generating…":"Generate 25 questions from this material"}</button></div>}
    {error&&<p className="auth-error">{error}</p>}
    <div className="flight-dashboard">
      <div className="flight-visual-panel">
        <div className="flight-sky-label"><span className="live-dot"></span>{gameOver?"FLIGHT COMPLETE":started?"FLIGHT IN PROGRESS":"FLIGHT DECK READY"}</div>
        <div className="flight-altitude"><span>ALTITUDE</span><strong>{altitude.toLocaleString()}<small> FT</small></strong><div className="altitude-track"><span style={{height:Math.max(0,Math.min(100,altitude/3000*100))+"%"}}/></div></div>
        <div className="flight-sky">
          <div className="sky-sun"></div><div className="sky-cloud cloud-a"></div><div className="sky-cloud cloud-b"></div><div className="sky-cloud cloud-c"></div><div className="sky-cloud cloud-d"></div><div className="sky-cloud cloud-e"></div><div className="flight-route-line"></div>
          <div className={"flight-plane "+(selected!==null&&question&&selected===question.answerIndex?"plane-boost":selected!==null?"plane-drop":"")} aria-label="Jet aircraft">
            <svg viewBox="0 0 120 150" role="img" aria-label="Silver jet pointing upwards"><defs><linearGradient id="adaptiveJetMetal" x1="0" x2="1"><stop offset="0" stopColor="#647d91"/><stop offset=".48" stopColor="#f5fbff"/><stop offset="1" stopColor="#526b80"/></linearGradient></defs><path d="M60 7 C69 28 72 57 75 83 L109 111 L108 122 L72 108 L68 137 L52 137 L48 108 L12 122 L11 111 L45 83 C48 57 51 28 60 7Z" fill="url(#adaptiveJetMetal)" stroke="#d9e8f1" strokeWidth="2"/><path d="M60 24 C66 42 66 54 64 66 L60 74 L56 66 C54 54 54 42 60 24Z" fill="#76d9f5"/></svg>
          </div>
          <div className="sky-coordinate coord-two">CLIMB RATE <b>{selected===null?"READY":question&&selected===question.answerIndex?"+250":"−300"}</b></div>
          {(!started||gameOver)&&<div className="flight-start-overlay"><div className="flight-start-icon">✈</div><strong>{gameOver?"Flight complete":"Ready for take-off?"}</strong><p>{gameOver?"Review the feedback and launch another round.":"Answer questions from your selected unit and materials."}</p><button className="flight-launch-button" onClick={reset}>{gameOver?"Restart flight":"Start your flight"} <span>→</span></button></div>}
        </div>
        <div className="flight-metrics"><div><span>CORRECT</span><strong>{correct}</strong></div><div><span>WRONG ANSWERS LEFT</span><strong>{Math.max(0,3-wrong)}</strong></div><div><span>QUESTIONS ANSWERED</span><strong>{index+(selected!==null?1:0)}</strong></div></div>
      </div>
      <div className="flight-question-panel">
        <div className="question-topline"><span>MISSION {String(index+1).padStart(2,"0")}</span><span>{question?.topic||"UNIT QUESTIONS"}</span></div>
        <div className="question-progress"><span style={{width:(activeQuestions.length?((index%activeQuestions.length)+1)/activeQuestions.length*100:0)+"%"}}/></div>
        <div className="question-difficulty">{question?.difficulty||"READY"} QUESTION</div>
        <h3>{started&&question&&!gameOver?question.question:"Your personalised clinical question is ready."}</h3>
        {started&&question&&!gameOver?<div className="flight-options">{question.options.map((option,i)=><button key={option+i} className={"flight-option "+(selected===null?"":i===question.answerIndex?"option-correct":i===selected?"option-wrong":"option-muted")} onClick={()=>answerQuestion(i)} disabled={selected!==null}><span className="option-letter">{String.fromCharCode(65+i)}</span><span>{option}</span><span className="option-mark">{selected!==null&&i===question.answerIndex?"✓":selected===i?"×":"↗"}</span></button>)}</div>:<div className="flight-mission-placeholder"><span>✦</span><p>{activeQuestions.length?"Start your flight to receive a question from the selected unit and source.":"No practice questions are available for this unit yet. Upload learning material and generate a question set."}</p></div>}
        {selected!==null&&question&&<div className={"flight-feedback "+(selected===question.answerIndex?"correct":"wrong")}><strong>{selected===question.answerIndex?"Excellent — altitude gained!":"Not quite — review the explanation."}</strong><p>{question.explanation}</p><div className="altitude-change">{selected===question.answerIndex?"+250":"−300"} FT</div>{!gameOver&&<div className="flight-auto-advance">Next question loading automatically…</div>}</div>}
        {!started&&!gameOver&&<div className="flight-howto"><span>HOW TO PLAY</span><p><b>Correct answer</b> <i>+</i> 250 ft</p><p><b>Wrong answer</b> <i>−</i> 300 ft</p><p><b>Four wrong answers</b> ends the flight.</p></div>}
        {gameOver&&<div className="flight-game-over-note"><strong>Flight summary</strong><p>You answered {correct} correctly and made {wrong} incorrect attempts. Your highest altitude is {bestAltitude.toLocaleString()} ft.</p></div>}
      </div>
    </div>
    <div className="flight-quiz-footer"><span><i></i> EDUCATIONAL GAME · UNIT-SPECIFIC PRACTICE</span><span>{activeQuestions.length} QUESTIONS AVAILABLE</span></div>
  </section>;
}
