"use client";

import { useEffect, useMemo, useState } from "react";
import { clinicalUnits } from "../lib/learning-content";
import { extractStudyFile } from "../lib/file-text";

type SummarySection = {
  heading: string;
  summary: string;
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
  const [tab,setTab] = useState<"summary"|"ask">("summary");
  const [question,setQuestion] = useState("");
  const [answer,setAnswer] = useState<TutorAnswer|null>(null);
  const [answering,setAnswering] = useState(false);

  const selectedMaterial = useMemo(()=>materials.find(item=>item.id===selectedId)||null,[materials,selectedId]);
  const unitName = (id:string)=>clinicalUnits.find(item=>item.id===id)?.name || id;

  const loadMaterials = async (preserveId = true) => {
    const response = await fetch("/api/learning/materials",{credentials:"same-origin",cache:"no-store"});
    const data = await readResponse(response);
    const next = Array.isArray(data.materials) ? data.materials as StudyMaterial[] : [];
    setMaterials(next);
    if (!preserveId || !next.some(item=>item.id===selectedId)) setSelectedId(next[0]?.id || "");
    return next;
  };

  useEffect(()=>{ loadMaterials().catch(e=>setError(e instanceof Error?e.message:"Could not load your study materials.")); },[]);

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
      setNotice("Your uploaded material is saved. The summary can be retried when the AI service is available.");
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
        body:JSON.stringify({materialId:selectedMaterial.id,count:25,level:"Mixed"})
      });
      const data = await readResponse(response);
      await loadMaterials(true);
      setNotice(`Created ${data.generated || data.questions?.length || 0} questions from ${selectedMaterial.title}. They are now available in the Question Bank and Flight Game.`);
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
        <span>Remove patient names, hospital numbers, contact details and other identifying information. Only text that can be extracted from the uploaded document is stored; scanned image-only files may need OCR or a text-based copy.</span>
      </div>

      <div className="materials-layout">
        <section className="materials-upload-card">
          <div className="eyebrow">ADD A RESOURCE</div>
          <h2>Upload learning material</h2>
          <p>One source can power your summary, tutor questions, question bank and unit-specific games.</p>
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
            <button className="text-link" onClick={()=>loadMaterials(false).catch(e=>setError(e.message))}>↻ Refresh</button>
          </div>
          {materials.length===0 ? <div className="materials-empty"><span>▤</span><strong>No study materials yet</strong><p>Upload your first lecture or revision document. It will appear here after it has been saved.</p></div> :
            <div className="materials-list">
              {materials.map(item=><div className={item.id===selectedId?"materials-list-item selected":"materials-list-item"} key={item.id}>
                <button className="materials-select" onClick={()=>{setSelectedId(item.id);setAnswer(null);setTab("summary");setError("");}}>
                  <span className="materials-file-badge">▤</span>
                  <span className="materials-item-copy"><strong>{item.title}</strong><small>{unitName(item.unit)} · {item.category} · {formatDate(item.createdAt)}</small><span>{item.summary?"Summary ready":"Summary not yet generated"} · {item.questions?.length||0} questions</span></span>
                </button>
                <button className="materials-delete" title="Remove material" onClick={()=>remove(item.id)}>×</button>
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
            <button className="secondary-button" onClick={()=>summarise(selectedMaterial.id)} disabled={working}>{selectedMaterial.summary?"Refresh summary":"Create summary"}</button>
            <button className="primary-button" onClick={generateQuestions} disabled={working}>{selectedMaterial.questions?.length?"Regenerate questions":"Generate 25 questions"} <span>→</span></button>
          </div>
        </div>
        <div className="materials-tabs">
          <button className={tab==="summary"?"active":""} onClick={()=>{setTab("summary");setError("");}}>Structured summary</button>
          <button className={tab==="ask"?"active":""} onClick={()=>{setTab("ask");setAnswer(null);setError("");}}>Ask this material</button>
        </div>

        {tab==="summary" && <>
          {selectedMaterial.summary ? <div className="study-summary">
            <section className="study-summary-overview"><div className="eyebrow">AT A GLANCE</div><p>{selectedMaterial.summary.overview}</p></section>
            {!!selectedMaterial.summary.learningObjectives?.length && <section className="study-summary-block"><h3>Learning objectives</h3><ul>{selectedMaterial.summary.learningObjectives.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            <div className="study-summary-sections">{selectedMaterial.summary.sections?.map((section,index)=><article className="study-summary-section" key={index}>
              <div className="study-summary-section-heading"><span>{String(index+1).padStart(2,"0")}</span><h3>{section.heading}</h3></div>
              {section.sourceLocator&&<small className="study-source-locator">Source: {section.sourceLocator}</small>}
              <p>{section.summary}</p>
              {section.clinicalRelevance&&<div className="study-clinical-relevance"><strong>Clinical relevance</strong><p>{section.clinicalRelevance}</p></div>}
              {!!section.highYieldPoints?.length&&<div className="study-high-yield"><strong>High-yield points</strong><ul>{section.highYieldPoints.map((point,i)=><li key={i}>{point}</li>)}</ul></div>}
            </article>)}</div>
            {!!selectedMaterial.summary.comparisonTables?.length&&<section className="study-summary-block"><h3>Comparison tables</h3>{selectedMaterial.summary.comparisonTables.map((table,index)=><div className="study-table-wrap" key={index}><strong>{table.title}</strong><table><thead><tr>{table.columns.map((column,i)=><th key={i}>{column}</th>)}</tr></thead><tbody>{table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>)}</section>}
            {!!selectedMaterial.summary.keyTerms?.length&&<section className="study-summary-block"><h3>Key terms</h3><div className="study-key-terms">{selectedMaterial.summary.keyTerms.map((item,index)=><div key={index}><strong>{item.term}</strong><p>{item.meaning}</p></div>)}</div></section>}
            {!!selectedMaterial.summary.memoryAids?.length&&<section className="study-summary-block"><h3>Memory aids</h3><ul>{selectedMaterial.summary.memoryAids.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            {!!selectedMaterial.summary.commonPitfalls?.length&&<section className="study-summary-block study-summary-warnings"><h3>Common pitfalls</h3><ul>{selectedMaterial.summary.commonPitfalls.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            {!!selectedMaterial.summary.revisionQuestions?.length&&<section className="study-summary-block"><h3>Quick revision questions</h3>{selectedMaterial.summary.revisionQuestions.map((item,index)=><details className="study-revision-question" key={index}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>}
            {!!selectedMaterial.summary.unclearOrMissing?.length&&<section className="study-summary-block study-summary-warnings"><h3>Topics to verify or supplement</h3><ul>{selectedMaterial.summary.unclearOrMissing.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            <p className="study-summary-disclaimer">{selectedMaterial.summary.disclaimer}</p>
          </div> : <div className="materials-empty"><span>✧</span><strong>No summary has been created</strong><p>Ask ClerkMe to organise the uploaded source into an explained, structured revision document.</p><button className="primary-button" onClick={()=>summarise(selectedMaterial.id)} disabled={working}>Create structured summary →</button></div>}
        </>}

        {tab==="ask" && <div className="study-tutor-panel">
          <div className="study-tutor-intro"><div className="eyebrow">SOURCE-GROUNDED AI TUTOR</div><h3>Ask questions about {selectedMaterial.title}</h3><p>ClerkMe will use this material first, explain the answer and identify where the source supports it. It will tell you when the document does not contain enough information.</p></div>
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
