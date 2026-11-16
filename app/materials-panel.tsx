"use client";

import { useEffect, useMemo, useState } from "react";
import { clinicalUnits } from "../lib/learning-content";
import { extractStudyFile } from "../lib/file-text";

type SummarySection = {
  heading: string;
  summary: string;
  subsections?: Array<{heading:string;explanation:string;keyPoints?:string[]}>;
  clinicalRelevance?: string;
  highYieldPoints?: string[];
  sourceLocator?: string;
};
type StudySummary = {
  overview: string;
  learningObjectives?: string[];
  sections: SummarySection[];
  keyTerms?: Array<{term:string;meaning:string}>;
  comparisonTables?: Array<{title:string;columns:string[];rows:string[][]}>;
  memoryAids?: string[];
  commonPitfalls?: string[];
  revisionQuestions?: Array<{question:string;answer:string}>;
  unclearOrMissing?: string[];
  sourceCoverage?: string[];
  examFocus?: {
    mustKnow: string[];
    likelyShortNotes: string[];
    vivaQuestions: Array<{question:string;answer:string}>;
    clinicalApplications: string[];
  } | null;
  flowcharts?: Array<{title:string;steps:string[];takeaway?:string}>;
  videoSuggestions?: Array<{topic:string;whyWatch:string;channel:string}>;
  disclaimer?: string;
};
type MaterialQuestion = {
  question:string;
  options:string[];
  answerIndex:number;
  explanation:string;
  topic:string;
  difficulty:string;
};
type StudyMaterial = {
  id:string;
  title:string;
  sourceName:string;
  unit:string;
  category:string;
  mimeType:string|null;
  summary:StudySummary|null;
  questions:MaterialQuestion[];
  createdAt:number;
  updatedAt:number;
};
type TutorAnswer = {
  answer:string;
  keyPoints:string[];
  clinicalReasoning:string;
  sourceSupport:Array<{locator:string;support:string}>;
  supplementaryContext:string;
  limitations:string[];
  followUpQuestions:string[];
};

async function readResponse(response: Response) {
  const data = await response.json().catch(()=>({error:"The server returned an unreadable response."}));
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}
function formatDate(timestamp:number) {
  if (!timestamp) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium"}).format(new Date(timestamp*1000));
}
function formatTimer(seconds:number) {
  const safe = Math.max(0,Math.floor(seconds));
  return String(Math.floor(safe/60)).padStart(2,"0")+":"+String(safe%60).padStart(2,"0");
}
const ACTIVE_LIVE_MATERIAL_KEY = "clerkme:live-test:active-material";
const liveSessionKey = (materialId:string) => "clerkme:live-test:"+materialId;

export default function MaterialsPanel() {
  const [materials,setMaterials] = useState<StudyMaterial[]>([]);
  const [unit,setUnit] = useState("general-medicine");
  const [category,setCategory] = useState("Lecture notes");
  const [title,setTitle] = useState("");
  const [file,setFile] = useState<File|null>(null);
  const [selectedId,setSelectedId] = useState("");
  const [uploading,setUploading] = useState(false);
  const [working,setWorking] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [tab,setTab] = useState<"summary"|"questions"|"ask">("summary");
  const [questionIndex,setQuestionIndex] = useState(0);
  const [questionAnswers,setQuestionAnswers] = useState<Record<number,number>>({});
  const [quizFinished,setQuizFinished] = useState(false);
  const [quizMode,setQuizMode] = useState<"practice"|"live">("practice");
  const [durationChoice,setDurationChoice] = useState("20");
  const [customDuration,setCustomDuration] = useState("30");
  const [liveDeadline,setLiveDeadline] = useState<number|null>(null);
  const [liveStartedAt,setLiveStartedAt] = useState<number|null>(null);
  const [liveDurationSeconds,setLiveDurationSeconds] = useState(20*60);
  const [remainingSeconds,setRemainingSeconds] = useState(20*60);
  const [liveElapsedSeconds,setLiveElapsedSeconds] = useState(0);
  const [liveTimedOut,setLiveTimedOut] = useState(false);
  const [sessionHydratedFor,setSessionHydratedFor] = useState("");
  const [question,setQuestion] = useState("");
  const [answer,setAnswer] = useState<TutorAnswer|null>(null);
  const [answering,setAnswering] = useState(false);
  const [questionCount,setQuestionCount] = useState(25);
  const [questionDifficulty,setQuestionDifficulty] = useState("Mixed");

  const selectedMaterial = useMemo(()=>materials.find(item=>item.id===selectedId)||null,[materials,selectedId]);
  const activeQuestions = selectedMaterial?.questions || [];
  const activeQuestionCount = activeQuestions.length;
  const answeredCount = Object.keys(questionAnswers).length;
  const correctCount = activeQuestions.reduce((total,item,index)=>total+(questionAnswers[index]===item.answerIndex?1:0),0);
  const currentQuestion = activeQuestions[questionIndex] || null;
  const currentAnswer = questionAnswers[questionIndex] ?? null;
  const scorePercent = activeQuestions.length ? Math.round(correctCount/activeQuestions.length*100) : 0;
  const requestedMinutes = durationChoice==="custom" ? Number(customDuration) : Number(durationChoice);
  const liveDurationMinutes = Number.isFinite(requestedMinutes) ? Math.max(5,Math.min(180,Math.round(requestedMinutes))) : 20;
  const liveInProgress = quizMode==="live" && liveDeadline!==null && !quizFinished;
  const timerUrgency = remainingSeconds<=60 ? "urgent" : remainingSeconds<=300 ? "warning" : "";
  const unitName = (id:string)=>clinicalUnits.find(item=>item.id===id)?.name || id;

  const loadMaterials = async (preserveId = true) => {
    const response = await fetch("/api/learning/materials",{credentials:"same-origin",cache:"no-store"});
    const data = await readResponse(response);
    const next = Array.isArray(data.materials) ? data.materials as StudyMaterial[] : [];
    setMaterials(next);
    if (!preserveId || !next.some(item=>item.id===selectedId)) {
      let savedMaterialId = "";
      try { savedMaterialId = window.sessionStorage.getItem(ACTIVE_LIVE_MATERIAL_KEY) || ""; } catch {}
      const savedMaterialExists = savedMaterialId && next.some(item=>item.id===savedMaterialId);
      if (savedMaterialId && !savedMaterialExists) {
        try {
          window.sessionStorage.removeItem(liveSessionKey(savedMaterialId));
          window.sessionStorage.removeItem(ACTIVE_LIVE_MATERIAL_KEY);
        } catch {}
      }
      setSelectedId(savedMaterialExists ? savedMaterialId : next[0]?.id || "");
    }
    return next;
  };

  useEffect(()=>{ loadMaterials().catch(e=>setError(e instanceof Error?e.message:"Could not load your study materials.")); },[]);

  useEffect(()=>{
    if (!selectedId) return;
    let restored = false;
    try {
      const raw = window.sessionStorage.getItem(liveSessionKey(selectedId));
      if (raw) {
        const saved = JSON.parse(raw) as Record<string,unknown>;
        const deadline = Number(saved.deadline);
        const startedAt = Number(saved.startedAt);
        const durationSeconds = Number(saved.durationSeconds);
        if (Number.isFinite(deadline) && deadline>0 && Number.isFinite(startedAt) && startedAt>0 &&
            Number.isInteger(durationSeconds) && durationSeconds>=5*60 && durationSeconds<=180*60) {
          const savedIndex = Number(saved.questionIndex);
          const safeIndex = Number.isInteger(savedIndex) ? Math.max(0,Math.min(Math.max(0,activeQuestionCount-1),savedIndex)) : 0;
          const sourceAnswers = saved.answers && typeof saved.answers==="object" ? saved.answers as Record<string,unknown> : {};
          const safeAnswers:Record<number,number> = {};
          for (const [key,value] of Object.entries(sourceAnswers)) {
            const questionNumber = Number(key);
            if (Number.isInteger(questionNumber) && questionNumber>=0 && questionNumber<activeQuestionCount &&
                Number.isInteger(value) && Number(value)>=0 && Number(value)<4) {
              safeAnswers[questionNumber] = Number(value);
            }
          }
          setQuizMode("live");
          setQuestionIndex(safeIndex);
          setQuestionAnswers(safeAnswers);
          setQuizFinished(false);
          setLiveTimedOut(false);
          setLiveStartedAt(startedAt);
          setLiveDurationSeconds(durationSeconds);
          setLiveDeadline(deadline);
          setRemainingSeconds(Math.max(0,Math.ceil((deadline-Date.now())/1000)));
          setLiveElapsedSeconds(Math.min(durationSeconds,Math.max(0,Math.floor((Date.now()-startedAt)/1000))));
          setTab("questions");
          restored = true;
        } else {
          window.sessionStorage.removeItem(liveSessionKey(selectedId));
          if (window.sessionStorage.getItem(ACTIVE_LIVE_MATERIAL_KEY)===selectedId) window.sessionStorage.removeItem(ACTIVE_LIVE_MATERIAL_KEY);
        }
      }
    } catch {
      try {
        window.sessionStorage.removeItem(liveSessionKey(selectedId));
        if (window.sessionStorage.getItem(ACTIVE_LIVE_MATERIAL_KEY)===selectedId) window.sessionStorage.removeItem(ACTIVE_LIVE_MATERIAL_KEY);
      } catch {}
    }
    setSessionHydratedFor(selectedId);
    if (!restored) setQuizMode("practice");
  },[selectedId,activeQuestionCount]);

  useEffect(()=>{
    if (!selectedId || sessionHydratedFor!==selectedId) return;
    try {
      if (quizMode==="live" && liveDeadline!==null && liveStartedAt!==null && !quizFinished) {
        window.sessionStorage.setItem(ACTIVE_LIVE_MATERIAL_KEY,selectedId);
        window.sessionStorage.setItem(liveSessionKey(selectedId),JSON.stringify({
          deadline:liveDeadline,
          startedAt:liveStartedAt,
          durationSeconds:liveDurationSeconds,
          questionIndex,
          answers:questionAnswers
        }));
      } else {
        window.sessionStorage.removeItem(liveSessionKey(selectedId));
        if (window.sessionStorage.getItem(ACTIVE_LIVE_MATERIAL_KEY)===selectedId) window.sessionStorage.removeItem(ACTIVE_LIVE_MATERIAL_KEY);
      }
    } catch {}
  },[selectedId,sessionHydratedFor,quizMode,liveDeadline,liveStartedAt,liveDurationSeconds,questionIndex,questionAnswers,quizFinished]);

  useEffect(()=>{
    if (quizMode!=="live" || liveDeadline===null || quizFinished) return;
    const updateCountdown = () => {
      const secondsLeft = Math.max(0,Math.ceil((liveDeadline-Date.now())/1000));
      setRemainingSeconds(secondsLeft);
      if (secondsLeft===0) {
        setLiveTimedOut(true);
        setLiveElapsedSeconds(liveDurationSeconds);
        setQuizFinished(true);
        setLiveDeadline(null);
      }
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown,1000);
    return ()=>window.clearInterval(interval);
  },[quizMode,liveDeadline,liveStartedAt,liveDurationSeconds,quizFinished]);

  const switchQuizMode = (mode:"practice"|"live") => {
    if (liveInProgress) return;
    setQuizMode(mode);
    setQuestionIndex(0);
    setQuestionAnswers({});
    setQuizFinished(false);
    setLiveDeadline(null);
    setLiveStartedAt(null);
    setLiveElapsedSeconds(0);
    setLiveTimedOut(false);
    setRemainingSeconds(liveDurationMinutes*60);
  };

  const startLiveTest = () => {
    const seconds = liveDurationMinutes*60;
    const startedAt = Date.now();
    setQuizMode("live");
    setQuestionIndex(0);
    setQuestionAnswers({});
    setQuizFinished(false);
    setLiveTimedOut(false);
    setLiveElapsedSeconds(0);
    setLiveDurationSeconds(seconds);
    setRemainingSeconds(seconds);
    setLiveStartedAt(startedAt);
    setLiveDeadline(startedAt+seconds*1000);
  };

  const finishLiveTest = (timedOut=false) => {
    const elapsed = liveStartedAt===null ? 0 : Math.min(liveDurationSeconds,Math.max(0,Math.floor((Date.now()-liveStartedAt)/1000)));
    setLiveElapsedSeconds(elapsed);
    setLiveTimedOut(timedOut);
    setQuizFinished(true);
    setLiveDeadline(null);
    if (timedOut) setRemainingSeconds(0);
  };

  const summarise = async (materialId:string) => {
    setWorking(true); setError(""); setNotice("Creating a structured summary from the uploaded source…");
    try {
      const response = await fetch("/api/learning/summarise",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({materialId})
      });
      const data = await readResponse(response);
      setMaterials(current=>current.map(item=>item.id===materialId?{...item,summary:data.summary}:item));
      setNotice("Summary prepared. Review the source and the highlighted areas that need verification.");
      setTab("summary");
    } catch(e) {
      setError(e instanceof Error?e.message:"Could not summarise this material.");
      setNotice("Your uploaded material is saved. The summary can be retried when the study service is available.");
    } finally { setWorking(false); }
  };

  const upload = async () => {
    if (!file) { setError("Choose a document first."); return; }
    setUploading(true); setError(""); setNotice(""); setAnswer(null);
    try {
      const extracted = await extractStudyFile(file);
      const response = await fetch("/api/learning/materials",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({
          title:title.trim() || file.name.replace(/\.[^.]+$/,""),
          sourceName:file.name,unit,category,mimeType:file.type || null,contentText:extracted.text
        })
      });
      const data = await readResponse(response);
      const material = data.material as StudyMaterial;
      setMaterials(current=>[material,...current.filter(item=>item.id!==material.id)]);
      setSelectedId(material.id);
      setTitle(""); setFile(null);
      setNotice("Material uploaded and saved to your private library. Preparing its summary…");
      await summarise(material.id);
    } catch(e) {
      setError(e instanceof Error?e.message:"Could not upload this material.");
    } finally { setUploading(false); }
  };

  const generateQuestions = async () => {
    if (!selectedMaterial) return;
    setWorking(true); setError(""); setNotice("Creating unit- and source-specific practice questions…");
    try {
      const response = await fetch("/api/learning/generate",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({materialId:selectedMaterial.id,count:questionCount,level:questionDifficulty})
      });
      const data = await readResponse(response);
      const refreshedMaterials = await loadMaterials(true);
      const refreshedMaterial = refreshedMaterials.find(item=>item.id===selectedMaterial.id);
      const generated = Number(refreshedMaterial?.questions?.length || data.generated || data.questions?.length || 0);
      const requested = Number(data.requested || questionCount);
      setQuestionIndex(0);
      setQuestionAnswers({});
      setQuizFinished(false);
      setQuizMode("practice");
      setLiveDeadline(null);
      setLiveStartedAt(null);
      setLiveElapsedSeconds(0);
      setLiveTimedOut(false);
      if (generated > 0) setTab("questions");
      setNotice(data.complete === false
        ? `Generated ${generated} of ${requested} requested questions from ${selectedMaterial.title}. ${data.warning || "You can start practising the questions generated so far."}`
        : `Your ${generated} questions from ${selectedMaterial.title} are ready. You can start answering now or read the structured summary first.`);
    } catch(e) {
      setError(e instanceof Error?e.message:"Could not create questions from this material.");
    } finally { setWorking(false); }
  };

  const ask = async () => {
    if (!selectedMaterial || question.trim().length<5) return;
    setAnswering(true); setError(""); setAnswer(null);
    try {
      const response = await fetch("/api/learning/ask",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({materialId:selectedMaterial.id,question})
      });
      const data = await readResponse(response);
      setAnswer(data as TutorAnswer);
    } catch(e) {
      setError(e instanceof Error?e.message:"The tutor could not answer this question.");
    } finally { setAnswering(false); }
  };

  const remove = async (materialId:string) => {
    if (!window.confirm("Remove this material and its generated summary and questions from your private library?")) return;
    setError(""); setNotice("");
    try {
      await readResponse(await fetch("/api/learning/materials",{
        method:"DELETE",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({id:materialId})
      }));
      const next = materials.filter(item=>item.id!==materialId);
      setMaterials(next);
      if (selectedId===materialId) setSelectedId(next[0]?.id||"");
      setAnswer(null); setNotice("Material removed from your library.");
    } catch(e) { setError(e instanceof Error?e.message:"Could not remove this material."); }
  };

  return (
    <div className="materials-workspace">
      <div className="page-intro">
        <div className="eyebrow">YOUR PRIVATE STUDY LIBRARY</div>
        <h1>My study materials</h1>
        <p>Upload lecture notes, presentations and study documents. ClerkMe organises each source into clear revision notes, answers questions from the material and builds practice questions for the selected unit.</p>
      </div>

      <div className="materials-safety-note">
        <strong>Upload learning resources, not identifiable patient records.</strong>
        <span>Remove patient names, hospital numbers, contact details and other identifying information. This version retains the extracted text, summary and generated questions, not the original binary file. Scanned image-only files may need OCR or a text-based copy.</span>
      </div>

      <div className="materials-layout">
        <section className="materials-upload-card">
          <div className="eyebrow">ADD A RESOURCE</div>
          <h2>Upload learning material</h2>
          <p>Use one source for structured summaries, study questions and unit-specific practice.</p>
          <label>Clinical unit
            <select value={unit} onChange={event=>setUnit(event.target.value)}>
              {clinicalUnits.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Material type
            <select value={category} onChange={event=>setCategory(event.target.value)}>
              <option>Lecture notes</option><option>Lecture slides</option><option>Textbook extract</option><option>Clinical guideline</option><option>Personal revision notes</option><option>Other study resource</option>
            </select>
          </label>
          <label>Display title (optional)
            <input value={title} onChange={event=>setTitle(event.target.value)} placeholder="e.g. Acute coronary syndromes — lecture 2"/>
          </label>
          <label className="materials-file-picker">
            <span className="materials-file-icon">⇧</span>
            <span><strong>{file?file.name:"Choose a file to upload"}</strong><small>{file?`${Math.max(1,Math.round(file.size/1024))} KB · ready to extract`:"PDF, PPTX, DOCX, TXT, MD or CSV · up to 20 MB"}</small></span>
            <input type="file" accept=".pdf,.pptx,.docx,.txt,.md,.csv" onChange={event=>{setFile(event.target.files?.[0]||null);setError("");setNotice("");}}/>
          </label>
          <button className="primary-button materials-action-button" onClick={upload} disabled={!file||uploading}>
            {uploading?"Uploading and preparing summary…":"Upload and organise material"} <span>→</span>
          </button>
          <div className="materials-processing-steps">
            <span>01 · Extract text</span><span>02 · Organise summary</span><span>03 · Generate practice</span>
          </div>
        </section>

        <section className="materials-library-card">
          <div className="materials-library-heading">
            <div><div className="eyebrow">YOUR RESOURCES</div><h2>Study library <span>{materials.length}</span></h2></div>
            <button className="text-link" disabled={liveInProgress} onClick={()=>loadMaterials(false).catch(e=>setError(e.message))}>↻ Refresh</button>
          </div>
          {materials.length===0 ? <div className="materials-empty"><span>▤</span><strong>No study materials yet</strong><p>Upload your first lecture or revision document. It will appear here after it has been saved.</p></div> :
            <div className="materials-list">
              {materials.map(item=><div className={item.id===selectedId?"materials-list-item selected":"materials-list-item"} key={item.id}>
                <button className="materials-select" disabled={liveInProgress} onClick={()=>{setSelectedId(item.id);setAnswer(null);setTab("summary");setQuestionIndex(0);setQuestionAnswers({});setQuizFinished(false);setQuizMode("practice");setLiveDeadline(null);setLiveStartedAt(null);setLiveElapsedSeconds(0);setLiveTimedOut(false);setError("");}}>
                  <span className="materials-file-badge">▤</span>
                  <span className="materials-item-copy"><strong>{item.title}</strong><small>{unitName(item.unit)} · {item.category} · {formatDate(item.createdAt)}</small><span>{item.summary?"Summary ready":"Summary not yet generated"} · {item.questions?.length||0} questions</span></span>
                </button>
                <button className="materials-delete" title="Remove material" disabled={liveInProgress} onClick={()=>remove(item.id)}>×</button>
              </div>)}
            </div>}
        </section>
      </div>

      {error&&<p className="auth-error materials-feedback">{error}</p>}
      {notice&&<p className="success-note materials-feedback">{notice}</p>}

      {selectedMaterial && <section className="materials-detail-card">
        <div className="materials-detail-heading">
          <div><div className="eyebrow">{unitName(selectedMaterial.unit).toUpperCase()} · {selectedMaterial.category.toUpperCase()}</div><h2>{selectedMaterial.title}</h2><p>{selectedMaterial.sourceName} · Added {formatDate(selectedMaterial.createdAt)}</p></div>
          <div className="materials-detail-actions">
            <button className="secondary-button" onClick={()=>summarise(selectedMaterial.id)} disabled={working||liveInProgress}>{selectedMaterial.summary?"Refresh summary":"Create summary"}</button>
            <div className="materials-generation-controls">
              <label>Number of questions
                <select value={questionCount} onChange={event=>setQuestionCount(Number(event.target.value))} disabled={working||liveInProgress}>
                  <option value={10}>10 questions</option><option value={15}>15 questions</option><option value={25}>25 questions</option><option value={40}>40 questions</option>
                </select>
              </label>
              <label>Difficulty
                <select value={questionDifficulty} onChange={event=>setQuestionDifficulty(event.target.value)} disabled={working||liveInProgress}>
                  <option>Mixed</option><option>Easy</option><option>Moderate</option><option>Hard</option>
                </select>
              </label>
            </div>
            <button className="primary-button" onClick={generateQuestions} disabled={working||liveInProgress}>{working?"Preparing questions…":"Generate "+questionCount+" questions"} <span>→</span></button>
          </div>
        </div>
        <div className="materials-tabs">
          <button className={tab==="summary"?"active":""} disabled={liveInProgress} onClick={()=>{setTab("summary");setError("");}}>Study summary</button>
          <button className={tab==="questions"?"active":""} onClick={()=>{setTab("questions");setError("");}}>Practice MCQs <span className="materials-tab-count">{selectedMaterial.questions?.length||0}</span></button>
          <button className={tab==="ask"?"active":""} disabled={liveInProgress} onClick={()=>{setTab("ask");setAnswer(null);setError("");}}>Ask this material</button>
        </div>

        {tab==="summary" && <>
          {selectedMaterial.summary ? <div className="study-summary">
            <div className="study-guide-toolbar">
              <div><span className="eyebrow">YOUR EXAM-READY REVISION GUIDE</span><p>Read the topic in sequence, revise the high-yield points, then test yourself with the generated MCQs.</p></div>
              <div className="study-guide-toolbar-actions">
                {activeQuestions.length>0&&<button type="button" className="primary-button" onClick={()=>setTab("questions")}>Start MCQ practice <span>→</span></button>}
                <button type="button" className="secondary-button" onClick={()=>window.print()}>Print / Save PDF</button>
              </div>
            </div>
            {!!selectedMaterial.summary.sections?.length&&<nav className="study-contents" aria-label="Study guide contents"><strong>In this guide</strong><div>{selectedMaterial.summary.sections.map((section,index)=><a key={index} href={`#study-section-${index+1}`}>{String(index+1).padStart(2,"0")} · {section.heading}</a>)}</div></nav>}
            <section className="study-summary-overview"><div className="eyebrow">AT A GLANCE</div><p>{selectedMaterial.summary.overview}</p></section>
            {!!selectedMaterial.summary.learningObjectives?.length && <section className="study-summary-block"><h3>Learning objectives</h3><ul>{selectedMaterial.summary.learningObjectives.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            {!!selectedMaterial.summary.examFocus&&<section className="study-summary-block study-exam-focus">
              <div className="eyebrow">EXAM REVISION</div><h3>What to know for your examinations</h3>
              {!!selectedMaterial.summary.examFocus.mustKnow?.length&&<div className="study-exam-subsection"><h4>Must-know knowledge</h4><ul>{selectedMaterial.summary.examFocus.mustKnow.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
              {!!selectedMaterial.summary.examFocus.likelyShortNotes?.length&&<div className="study-exam-subsection"><h4>Short-note themes to prepare</h4><ul>{selectedMaterial.summary.examFocus.likelyShortNotes.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
              {!!selectedMaterial.summary.examFocus.clinicalApplications?.length&&<div className="study-exam-subsection"><h4>Clinical application</h4><ul>{selectedMaterial.summary.examFocus.clinicalApplications.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
              {!!selectedMaterial.summary.examFocus.vivaQuestions?.length&&<div className="study-exam-subsection"><h4>Viva practice</h4>{selectedMaterial.summary.examFocus.vivaQuestions.map((item,index)=><details className="study-revision-question" key={index}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>}
            </section>}
            <div className="study-summary-sections">{selectedMaterial.summary.sections?.map((section,index)=><article id={`study-section-${index+1}`} className="study-summary-section" key={index}>
              <div className="study-summary-section-heading"><span>{String(index+1).padStart(2,"0")}</span><h3>{section.heading}</h3></div>
              {section.sourceLocator&&<small className="study-source-locator">Source: {section.sourceLocator}</small>}
              <p className="study-section-lead">{section.summary}</p>
              {!!section.subsections?.length&&<div className="study-topic-subsections">{section.subsections.map((subsection,subIndex)=><section className="study-topic-subsection" key={subIndex}><h4>{subsection.heading}</h4><p>{subsection.explanation}</p>{!!subsection.keyPoints?.length&&<ul>{subsection.keyPoints.map((point,pointIndex)=><li key={pointIndex}>{point}</li>)}</ul>}</section>)}</div>}
              {section.clinicalRelevance&&<div className="study-clinical-relevance"><strong>Clinical relevance</strong><p>{section.clinicalRelevance}</p></div>}
              {!!section.highYieldPoints?.length&&<div className="study-high-yield"><strong>High-yield points</strong><ul>{section.highYieldPoints.map((point,i)=><li key={i}>{point}</li>)}</ul></div>}
            </article>)}</div>
            {!!selectedMaterial.summary.comparisonTables?.length&&<section className="study-summary-block"><h3>Comparison tables</h3>{selectedMaterial.summary.comparisonTables.map((table,index)=><div className="study-table-wrap" key={index}><strong>{table.title}</strong><table><thead><tr>{table.columns.map((column,i)=><th key={i}>{column}</th>)}</tr></thead><tbody>{table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>)}</section>}
            {!!selectedMaterial.summary.keyTerms?.length&&<section className="study-summary-block"><h3>Key terms</h3><div className="study-key-terms">{selectedMaterial.summary.keyTerms.map((item,index)=><div key={index}><strong>{item.term}</strong><p>{item.meaning}</p></div>)}</div></section>}
            {!!selectedMaterial.summary.flowcharts?.length&&<section className="study-summary-block study-flowcharts"><h3>Visual learning pathways</h3><p className="study-section-intro">Use these simplified sequences to connect the steps and understand how the process fits together.</p>{selectedMaterial.summary.flowcharts.map((flow,index)=><div className="study-flowchart" key={index}><strong>{flow.title}</strong><ol>{flow.steps.map((step,stepIndex)=><li key={stepIndex}><span>{String(stepIndex+1).padStart(2,"0")}</span><p>{step}</p></li>)}</ol>{flow.takeaway&&<p className="study-flowchart-takeaway"><b>Remember:</b> {flow.takeaway}</p>}</div>)}</section>}
            {!!selectedMaterial.summary.videoSuggestions?.length&&<section className="study-summary-block study-video-resources"><h3>Watch a related lecture</h3><p className="study-section-intro">Topic-specific YouTube searches from established medical-education channels. Open a result and check that its level and guidance match your course.</p><div className="study-video-grid">{selectedMaterial.summary.videoSuggestions.map((video,index)=><a className="study-video-link" key={index} href={"https://www.youtube.com/results?search_query="+encodeURIComponent(video.topic+" "+video.channel+" medical lecture")} target="_blank" rel="noopener noreferrer"><span className="study-video-play">▶</span><span><strong>{video.topic}</strong><small>{video.channel}</small>{video.whyWatch&&<p>{video.whyWatch}</p>}</span><b>↗</b></a>)}</div></section>}
            {!!selectedMaterial.summary.memoryAids?.length&&<section className="study-summary-block"><h3>Memory aids</h3><ul>{selectedMaterial.summary.memoryAids.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            {!!selectedMaterial.summary.commonPitfalls?.length&&<section className="study-summary-block study-summary-warnings"><h3>Common pitfalls</h3><ul>{selectedMaterial.summary.commonPitfalls.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            {!!selectedMaterial.summary.revisionQuestions?.length&&<section className="study-summary-block"><h3>Quick revision questions</h3>{selectedMaterial.summary.revisionQuestions.map((item,index)=><details className="study-revision-question" key={index}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>}
            {!!selectedMaterial.summary.unclearOrMissing?.length&&<section className="study-summary-block study-summary-warnings"><h3>Topics to verify or supplement</h3><ul>{selectedMaterial.summary.unclearOrMissing.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            {!!selectedMaterial.summary.sourceCoverage?.length&&<section className="study-summary-block"><h3>Topics covered from your source</h3><ul>{selectedMaterial.summary.sourceCoverage.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            <p className="study-summary-disclaimer">{selectedMaterial.summary.disclaimer}</p>
          </div> : <div className="materials-empty"><span>•</span><strong>No summary has been created</strong><p>Ask ClerkMe to organise the uploaded source into an explained, structured revision document.</p><button className="primary-button" onClick={()=>summarise(selectedMaterial.id)} disabled={working}>Create structured summary →</button></div>}
        </>}



        {tab==="questions" && <div className="study-mcq-panel">
          {activeQuestions.length>0 ? <>
            <div className="study-mcq-heading">
              <div><div className="eyebrow">SOURCE-SPECIFIC EXAM PRACTICE</div><h3>{selectedMaterial.title}: MCQ practice</h3><p>Choose Practice for immediate teaching feedback, or Live test for a timed examination simulation with all answers and explanations revealed after submission.</p></div>
              <div className="study-mcq-heading-actions"><button type="button" className="text-link" onClick={()=>setTab("summary")} disabled={liveInProgress}>← Read summary</button></div>
            </div>

            <div className="study-mcq-mode-switch" role="group" aria-label="Choose MCQ mode">
              <button type="button" className={quizMode==="practice"?"active":""} aria-pressed={quizMode==="practice"} disabled={liveInProgress} onClick={()=>switchQuizMode("practice")}><strong>Practice</strong><span>Instant feedback after each answer</span></button>
              <button type="button" className={quizMode==="live"?"active":""} aria-pressed={quizMode==="live"} disabled={liveInProgress} onClick={()=>switchQuizMode("live")}><strong>Live test</strong><span>Timed · answers revealed at the end</span></button>
            </div>

            {quizMode==="live" && liveDeadline===null && !quizFinished && <section className="study-live-setup">
              <div className="eyebrow">EXAM SIMULATION SETTINGS</div>
              <h3>Set your time before you begin</h3>
              <p>This is the total time for the entire question set, not time per question. You can move between questions and change your selected answers until you submit or the timer reaches zero. The clock continues if you move to another ClerkMe section and return.</p>
              <div className="study-live-setup-fields">
                <label>Total time allowed
                  <select value={durationChoice} onChange={event=>setDurationChoice(event.target.value)}>
                    <option value="5">5 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="20">20 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">120 minutes</option>
                    <option value="custom">Custom time</option>
                  </select>
                </label>
                {durationChoice==="custom" && <label>Custom time (5–180 minutes)
                  <input type="number" min={5} max={180} step={5} value={customDuration} onChange={event=>setCustomDuration(event.target.value)}/>
                </label>}
              </div>
              <div className="study-live-setup-summary"><span>{activeQuestions.length} questions</span><b>·</b><span>{liveDurationMinutes} minutes total</span><b>·</b><span>Feedback at the end</span></div>
              <div className="study-live-setup-actions"><button type="button" className="primary-button" onClick={startLiveTest}>Start live test <span>→</span></button><span>The timer starts only when you press Start.</span></div>
            </section>}

            {(quizMode==="practice" || liveInProgress || quizFinished) && <>
              {quizMode==="live" && liveInProgress && <section className={"study-live-timer "+(timerUrgency?"is-"+timerUrgency:"")} aria-live="polite">
                <div className="study-live-timer-top"><div><span>TIME REMAINING</span><strong>{formatTimer(remainingSeconds)}</strong></div><span className="study-live-timer-note">Your answers are not marked until you submit.</span></div>
                <div className="study-live-timer-track"><span style={{width:Math.max(0,Math.min(100,(remainingSeconds/liveDurationSeconds)*100))+"%"}}/></div>
                {remainingSeconds<=300 && <p>{remainingSeconds<=60?"One minute or less remaining. Review your unanswered questions.":"Five minutes or less remaining. Check your progress and unanswered questions."}</p>}
              </section>}

              <div className="study-mcq-stats">
                <div><span>Question set</span><strong>{activeQuestions.length}</strong></div>
                <div><span>Answered</span><strong>{answeredCount}/{activeQuestions.length}</strong></div>
                {quizMode==="live" && !quizFinished
                  ? <div><span>Unanswered</span><strong>{activeQuestions.length-answeredCount}</strong></div>
                  : <div><span>Correct</span><strong>{correctCount}</strong></div>}
              </div>

              {quizFinished ? <section className="study-mcq-results">
                <div className="eyebrow">{quizMode==="live"?"LIVE TEST RESULTS":"PRACTICE COMPLETE"}</div>
                <div className="study-mcq-result-score">{scorePercent}<span>%</span></div>
                <h3>{correctCount} correct out of {activeQuestions.length}</h3>
                {quizMode==="live" ? <div className="study-live-result-time"><span>Time allowed <strong>{formatTimer(liveDurationSeconds)}</strong></span><span>Time used <strong>{formatTimer(liveElapsedSeconds)}</strong></span></div> : null}
                <p>{quizMode==="live"
                  ? liveTimedOut
                    ? "Time expired and your answers were submitted automatically. Review every explanation below."
                    : "Your live test has been submitted. Your answers and explanations are now available for review."
                  : "You answered "+answeredCount+" of "+activeQuestions.length+" questions. Review the explanations below, revisit the study guide, or try the set again."}</p>
                <div className="study-mcq-result-actions">
                  <button type="button" className="primary-button" onClick={()=>{setQuestionIndex(0);setQuestionAnswers({});setQuizFinished(false);setLiveDeadline(null);setLiveStartedAt(null);setLiveElapsedSeconds(0);setLiveTimedOut(false);if(quizMode==="live")setRemainingSeconds(liveDurationMinutes*60);}}>Try again</button>
                  <button type="button" className="secondary-button" onClick={()=>setTab("summary")}>Return to summary</button>
                  {quizMode==="live"&&<button type="button" className="text-link" onClick={()=>switchQuizMode("practice")}>Switch to practice</button>}
                </div>
                <div className="study-mcq-review-list"><h4>Answer review and explanations</h4>{activeQuestions.map((item,index)=><details key={index} className="study-mcq-review-item"><summary><span>Q{index+1}</span>{item.question}<b className={questionAnswers[index]===item.answerIndex?"review-correct":questionAnswers[index]===undefined?"review-unanswered":"review-wrong"}>{questionAnswers[index]===undefined?"Not answered":questionAnswers[index]===item.answerIndex?"Correct":"Incorrect"}</b></summary><p><strong>Your answer:</strong> {questionAnswers[index]===undefined?"Not answered":item.options[questionAnswers[index]]}</p><p><strong>Best answer:</strong> {item.options[item.answerIndex]}</p><p><strong>Explanation:</strong> {item.explanation}</p></details>)}</div>
              </section> : currentQuestion && <>
                <div className="study-mcq-progress-row"><span>QUESTION {questionIndex+1} OF {activeQuestions.length}</span><span>{currentQuestion.topic} · {currentQuestion.difficulty}</span></div>
                <div className="study-mcq-progress"><span style={{width:((questionIndex+1)/activeQuestions.length*100)+"%"}}/></div>
                <article className="study-mcq-question-card">
                  <span className="study-mcq-question-label">{quizMode==="live"?"LIVE TEST · SINGLE BEST ANSWER":"PRACTICE · SINGLE BEST ANSWER"}</span>
                  <h3>{currentQuestion.question}</h3>
                  <div className="study-mcq-options">{currentQuestion.options.map((option,optionIndex)=>{
                    const selectedOption = currentAnswer===optionIndex;
                    const optionClass = quizMode==="live"
                      ? (selectedOption?" is-selected":"")
                      : (currentAnswer===null?"":optionIndex===currentQuestion.answerIndex?" is-correct":selectedOption?" is-wrong":" is-muted");
                    return <button key={optionIndex} type="button" disabled={quizMode==="practice"&&currentAnswer!==null} aria-pressed={selectedOption} className={"study-mcq-option"+optionClass} onClick={()=>{setQuestionAnswers(previous=>({...previous,[questionIndex]:optionIndex}));fetch("/api/activity",{method:"POST",credentials:"same-origin"}).catch(()=>{});}}><span>{String.fromCharCode(65+optionIndex)}</span><b>{option}</b><i>{quizMode==="live"?(selectedOption?"●":""):(currentAnswer!==null&&optionIndex===currentQuestion.answerIndex?"✓":selectedOption?"×":"")}</i></button>;
                  })}</div>
                  {quizMode==="practice"&&currentAnswer!==null&&<div className={"study-mcq-feedback"+(currentAnswer===currentQuestion.answerIndex?" is-correct":" is-wrong")} role="status"><strong>{currentAnswer===currentQuestion.answerIndex?"Correct — well done.":"Not quite. Review this concept."}</strong><p><b>Best answer: {currentQuestion.options[currentQuestion.answerIndex]}.</b> {currentQuestion.explanation}</p></div>}
                  {quizMode==="live"&&<p className="study-live-answer-note">{currentAnswer===null?"Choose one answer. You can change it before submitting.":"Answer selected. You can change it at any time before submission."}</p>}
                  <div className="study-mcq-navigation">
                    <button type="button" className="secondary-button" disabled={questionIndex===0} onClick={()=>setQuestionIndex(index=>index-1)}>← Previous</button>
                    <span>{quizMode==="live"?answeredCount+" of "+activeQuestions.length+" answered":currentAnswer===null?"Choose one answer to see the explanation.":"Answer recorded for this practice question."}</span>
                    {quizMode==="live"
                      ? questionIndex===activeQuestions.length-1
                        ? <button type="button" className="primary-button" onClick={()=>{const unanswered=activeQuestions.length-answeredCount;if(unanswered>0&&!window.confirm("You have "+unanswered+" unanswered question(s). Submit your test now?"))return;finishLiveTest(false);}}>Submit live test</button>
                        : <button type="button" className="primary-button" onClick={()=>setQuestionIndex(index=>index+1)}>Next question →</button>
                      : <button type="button" className="primary-button" disabled={currentAnswer===null} onClick={()=>questionIndex===activeQuestions.length-1?setQuizFinished(true):setQuestionIndex(index=>index+1)}>{questionIndex===activeQuestions.length-1?"Finish practice":"Next question →"}</button>}
                  </div>
                </article>
                <div className="study-mcq-question-map"><strong>Jump to a question</strong><div>{activeQuestions.map((item,index)=><button type="button" key={index} aria-label={"Go to question "+(index+1)} aria-current={questionIndex===index?"step":undefined} className={(questionIndex===index?"is-current ":"")+(questionAnswers[index]!==undefined?"is-answered":"")} onClick={()=>setQuestionIndex(index)}>{index+1}</button>)}</div></div>
                {quizMode==="practice"
                  ? <button type="button" className="study-mcq-finish-link" onClick={()=>setQuizFinished(true)}>Finish and review this attempt</button>
                  : <button type="button" className="study-mcq-finish-link" onClick={()=>{const unanswered=activeQuestions.length-answeredCount;if(unanswered>0&&!window.confirm("You have "+unanswered+" unanswered question(s). Submit your test now?"))return;finishLiveTest(false);}}>Submit live test and reveal feedback</button>}
              </>}
            </>}
          </> : <div className="materials-empty"><span>✎</span><strong>No MCQs generated for this material yet</strong><p>Choose the number and difficulty above, then generate questions directly from this lecture. You can return to the summary at any time.</p><button type="button" className="primary-button" onClick={generateQuestions} disabled={working}>{working?"Generating questions…":"Generate MCQs now →"}</button></div>}
        </div>}

        {tab==="ask" && <div className="study-tutor-panel">
          <div className="study-tutor-intro"><div className="eyebrow">SOURCE-GROUNDED STUDY SUPPORT</div><h3>Ask questions about {selectedMaterial.title}</h3><p>ClerkMe will use this material first, explain the answer and identify where the source supports it. It will tell you when the document does not contain enough information.</p></div>
          <label className="study-question-input">Your question
            <textarea rows={3} value={question} onChange={event=>{setQuestion(event.target.value);setAnswer(null);}} placeholder="e.g. Explain the pathophysiology of left ventricular failure using this lecture…"/>
          </label>
          <button className="primary-button" onClick={ask} disabled={answering||question.trim().length<5}>{answering?"Finding an answer in your material…":"Ask ClerkMe"} <span>→</span></button>
          {answer && <div className="study-tutor-answer">
            <div className="eyebrow">CLERKME EXPLANATION</div><p className="study-answer-main">{answer.answer}</p>
            {!!answer.keyPoints?.length&&<div className="study-summary-block"><h4>Key points</h4><ul>{answer.keyPoints.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
            {answer.clinicalReasoning&&<div className="study-clinical-relevance"><strong>Clinical reasoning</strong><p>{answer.clinicalReasoning}</p></div>}
            {!!answer.sourceSupport?.length&&<div className="study-summary-block"><h4>Support from your source</h4>{answer.sourceSupport.map((item,index)=><div className="study-source-support" key={index}><strong>{item.locator||"Relevant source section"}</strong><p>{item.support}</p></div>)}</div>}
            {answer.supplementaryContext&&<div className="study-supplementary"><strong>Additional explanation</strong><p>{answer.supplementaryContext}</p></div>}
            {!!answer.limitations?.length&&<div className="study-summary-warnings"><strong>Limitations / points to verify</strong><ul>{answer.limitations.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
            {!!answer.followUpQuestions?.length&&<div className="study-summary-block"><h4>Test your understanding</h4><ul>{answer.followUpQuestions.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
          </div>}
        </div>}
      </section>}
      {!selectedMaterial && materials.length>0 && <p className="learning-note">Select a resource to view its summary, ask questions or generate a unit-specific question set.</p>}
    </div>
  );
}
