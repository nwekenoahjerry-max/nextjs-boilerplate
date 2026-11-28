"use client";

import { useMemo, useState } from "react";
import { clinicalUnits } from "../lib/learning-content";
import { goodHistoryExamples } from "../lib/good-history";
import { coreClerkingSections, unitClerkingFrameworks, type GuideSection } from "../lib/unit-clerking";
import { getUnitPresentationPathways, type PresentingComplaintPathway } from "../lib/presentation-pathways";
import { caseGuides } from "../lib/case-guides";

function BulletGroup({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return <div className="unit-guide-list"><strong>{title}</strong><ul>{items.map((item,index)=><li key={index}>{item}</li>)}</ul></div>;
}

function SectionCard({ item, index, open = false }: { item: GuideSection; index: number; open?: boolean }) {
  return (
    <details className="unit-guide-section" open={open}>
      <summary>
        <span className="unit-guide-number">{String(index + 1).padStart(2,"0")}</span>
        <span className="unit-guide-section-title">{item.title}</span>
        <span className="unit-guide-chevron">⌄</span>
      </summary>
      <div className="unit-guide-section-body">
        <p className="unit-guide-purpose">{item.purpose}</p>
        <BulletGroup title="Suggested questions and prompts" items={item.questions}/>
        <BulletGroup title="What to document" items={item.document}/>
        <div className="unit-guide-reasoning"><strong>Clinical reasoning</strong><p>{item.reasoning}</p></div>
        <BulletGroup title="Red flags and escalation points" items={item.redFlags}/>
        <BulletGroup title="Common omissions and pitfalls" items={item.pitfalls}/>
      </div>
    </details>
  );
}

export default function ClinicalGuides() {
  const [unit,setUnit] = useState("general-medicine");
  const [view,setView] = useState<"pathway"|"presentations">("presentations");
  const [selectedComplaintId,setSelectedComplaintId] = useState<string|null>(null);
  const [search,setSearch] = useState("");
  const [category,setCategory] = useState("All");
  const [askedItems,setAskedItems] = useState<Record<string,boolean>>({});
  const [copyNotice,setCopyNotice] = useState("");
  const framework = unitClerkingFrameworks[unit] || unitClerkingFrameworks["general-medicine"];
  const unitName = clinicalUnits.find(item=>item.id===unit)?.name || framework.title;
  const pathways = useMemo(()=>getUnitPresentationPathways(unit),[unit]);
  const categories = useMemo(()=>["All",...Array.from(new Set(pathways.map(item=>item.category)))],[pathways]);
  const filteredPathways = useMemo(()=>{
    const term=search.trim().toLowerCase();
    return pathways.filter(item=>(category==="All"||item.category===category)&&(!term||item.title.toLowerCase().includes(term)||item.category.toLowerCase().includes(term)));
  },[pathways,search,category]);
  const selectedComplaint = pathways.find(item=>item.id===selectedComplaintId) || null;
  const selectedGuide = selectedComplaint?.baseGuideId ? caseGuides.find(item=>item.id===selectedComplaint.baseGuideId) : null;
  const allChecklistQuestions = selectedComplaint?.questionGroups.flatMap((group,groupIndex)=>group.questions.map((_,questionIndex)=>`${groupIndex}-${questionIndex}`)) || [];
  const askedCount = allChecklistQuestions.filter(id=>askedItems[id]).length;
  const totalQuestions = allChecklistQuestions.length;
  const progress = totalQuestions ? Math.round((askedCount/totalQuestions)*100) : 0;

  const chooseUnit=(nextUnit:string)=>{
    setUnit(nextUnit);
    setSelectedComplaintId(null);
    setSearch("");
    setCategory("All");
    setAskedItems({});
  };
  const openComplaint=(id:string)=>{
    setView("presentations");
    setSearch("");
    setCategory("All");
    setSelectedComplaintId(id);
    setAskedItems({});
    setCopyNotice("");
  };
  const copyChecklist=async(item:PresentingComplaintPathway)=>{
    const text=[
      `CLERKME · ${unitName.toUpperCase()} · ${item.title.toUpperCase()}`,
      `Opening question: ${item.openingQuestion}`,
      ...item.questionGroups.flatMap(group=>[`\n${group.title}`,...group.questions.map(question=>`☐ ${question}`)]),
      `\nRed flags to screen for`,...item.redFlags.map(flag=>`• ${flag}`),
      `\nExamination focus`,...item.examinationFocus.map(point=>`• ${point}`),
      "\nEducational prompt only. Adapt to the patient and local clinical guidance."
    ].join("\n");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(text);
      setCopyNotice("Guide questions copied to your clipboard.");
    } catch {
      window.prompt("Copy the clerking guide below:",text);
      setCopyNotice("Use the copy prompt to copy the guide questions.");
    }
  };

  return (
    <div className="clinical-guides-workspace">
      <div className="page-intro">
        <div className="eyebrow">UNIT-BASED CLINICAL LEARNING</div>
        <h1>Clinical clerking guides</h1>
        <p>Start with the patient’s presenting complaint. ClerkMe gives you a focused sequence of questions, specialty-specific prompts, red flags and examination priorities.</p>
      </div>

      <div className="learning-toolbar unit-guide-toolbar">
        <label>Choose your clinical unit
          <select value={unit} onChange={event=>chooseUnit(event.target.value)}>
            {clinicalUnits.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <p>{framework.overview}</p>
      </div>

      <div className="unit-guide-tabs">
        <button type="button" className={view==="presentations"?"active":""} onClick={()=>{setView("presentations");setSelectedComplaintId(null);setCopyNotice("");}}>Presenting complaint guide <span className="guide-tab-primary">START HERE</span></button>
        <button type="button" className={view==="pathway"?"active":""} onClick={()=>{setView("pathway");setSelectedComplaintId(null);setCopyNotice("");}}>Full clerking pathway</button>
      </div>

      {view==="pathway" && <>
        <section className="unit-guide-intro-card">
          <div className="eyebrow">{framework.title.toUpperCase()} · COMPLETE WORKFLOW</div>
          <h2>From biodata to final presentation</h2>
          <p>{framework.overview}</p>
          <div className="unit-guide-outcomes">
            <strong>By the end of this guide, you should be able to:</strong>
            <ul>{framework.learningOutcomes.map((item,index)=><li key={index}>{item}</li>)}</ul>
          </div>
        </section>

        <div className="unit-guide-heading">
          <div><span className="eyebrow">PART 1 · UNIVERSAL CLERKING FRAMEWORK</span><h2>Core clerking sequence</h2></div>
          <span>{coreClerkingSections.length} stages</span>
        </div>
        <div className="unit-guide-sections">
          {coreClerkingSections.map((item,index)=><SectionCard key={item.title} item={item} index={index} open={index===0 || index===1}/>)}
        </div>

        <div className="unit-guide-heading">
          <div><span className="eyebrow">PART 2 · SPECIALTY-SPECIFIC REQUIREMENTS</span><h2>{unitName}: focused clerking modules</h2></div>
          <span>{framework.unitSections.length} modules</span>
        </div>
        <p className="unit-guide-supporting-copy">These modules expand the universal sequence. Add the relevant prompts to your history and examination rather than repeating information already obtained.</p>
        <div className="unit-guide-sections">
          {framework.unitSections.map((item,index)=><SectionCard key={item.title} item={item} index={index} open={index===0}/>)}
        </div>

        <section className="unit-guide-final-card">
          <div className="eyebrow">FINAL QUALITY CHECK</div>
          <h2>Before presenting your case</h2>
          <ul>
            <li>All facts are traceable to the patient, a named informant, an examination or a verified record.</li>
            <li>Unknown, not asked, not assessed and negative findings are clearly distinguished.</li>
            <li>The chronology is coherent and the most important positive and negative findings are included.</li>
            <li>Immediate threats, red flags and escalation decisions have been addressed.</li>
            <li>The summary, differential, investigation rationale and management plan agree with the evidence.</li>
            <li>Pending results, review responsibility, follow-up and safety-netting are explicit.</li>
          </ul>
          <p>Educational guide only. Follow current institutional protocols, local guidelines, supervision requirements and applicable safeguarding procedures.</p>
        </section>
      </>}

      {view==="presentations" && <>
        {!selectedComplaint && <>
          <div className="presentation-finder-heading">
            <div><span className="eyebrow">{framework.title.toUpperCase()} · PRESENTATION-LED CLERKING</span><h2>What is the patient presenting with?</h2><p>Select the closest presenting complaint. You can search by symptom or browse by clinical category.</p></div>
            <span className="presentation-count">{pathways.length} guides in this unit</span>
          </div>
          <div className="presentation-search-row">
            <label className="presentation-search"><span>⌕</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search a complaint, e.g. chest pain, fever, bleeding…" aria-label="Search presenting complaints"/></label>
            <label className="presentation-category-select"><span>Category</span><select value={category} onChange={event=>setCategory(event.target.value)}>{categories.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
          </div>
          <div className="presentation-quick-categories">
            {categories.map(item=><button type="button" key={item} className={category===item?"active":""} onClick={()=>setCategory(item)} aria-pressed={category===item}>{item}</button>)}
          </div>
          {filteredPathways.length ? <div className="presentation-pathway-grid">
            {filteredPathways.map((item,index)=><button type="button" className="presentation-pathway-card" key={item.id} onClick={()=>openComplaint(item.id)} aria-label={`See guide for ${item.title}`} title={`See guide for ${item.title}`}>
              <span className="presentation-card-top"><small>{String(index+1).padStart(2,"0")}</small><span>{item.category}</span></span>
              <strong>{item.title}</strong>
              <span className="presentation-card-desc">{item.openingQuestion}</span>
              <span className="presentation-card-bottom"><span>{item.questionGroups.reduce((sum,group)=>sum+group.questions.length,0)} focused questions</span><b>See guide →</b></span>
            </button>)}
          </div> : <div className="presentation-empty"><strong>No matching complaint in this unit.</strong><p>Try another search term or choose “All” categories.</p><button type="button" className="text-link" onClick={()=>{setSearch("");setCategory("All");}}>Clear filters</button></div>}
        </>}

        {selectedComplaint && <div className="presentation-detail" id="clinical-guide-detail" aria-live="polite">
          <button type="button" className="presentation-back" onClick={()=>{setSelectedComplaintId(null);setAskedItems({});setCopyNotice("");}}>← All {unitName} complaints</button>
          <div className="presentation-detail-heading">
            <div><span className="eyebrow">{unitName.toUpperCase()} · {selectedComplaint.category.toUpperCase()}</span><h2>How to clerk: {selectedComplaint.title}</h2><p>Use the prompts as a clinical conversation, not as a rigid questionnaire. Let the patient speak before narrowing the history.</p></div>
            <div className="presentation-detail-actions"><button type="button" className="secondary-button" onClick={()=>copyChecklist(selectedComplaint)}>Copy questions</button><button type="button" className="secondary-button" onClick={()=>window.print()}>Print guide</button></div>
            {copyNotice&&<p className="presentation-copy-status" role="status">{copyNotice}</p>}
          </div>

          <section className="presentation-opening-question">
            <span>START WITH AN OPEN QUESTION</span>
            <p>{selectedComplaint.openingQuestion}</p>
            <small>Listen without interruption first. Then follow the focused prompts below.</small>
          </section>

          <section className="presentation-checklist-panel">
            <div className="presentation-checklist-heading"><div><span className="eyebrow">FOCUSED HISTORY</span><h3>Questions to ask during this clerking</h3><p>Tick each prompt as you cover it. Unticked items are a reminder, not a reason to ask irrelevant questions.</p></div><div className="presentation-progress"><strong>{askedCount}/{totalQuestions}</strong><span>covered</span><div><i style={{width:`${progress}%`}}/></div></div></div>
            {selectedComplaint.questionGroups.map((group,groupIndex)=><div className="presentation-question-group" key={group.title}>
              <h4><span>{String(groupIndex+1).padStart(2,"0")}</span>{group.title}</h4>
              <div className="presentation-question-list">
                {group.questions.map((question,questionIndex)=>{
                  const id=`${groupIndex}-${questionIndex}`;
                  return <label className={askedItems[id]?"asked":""} key={id}><input type="checkbox" checked={Boolean(askedItems[id])} onChange={event=>setAskedItems(current=>({...current,[id]:event.target.checked}))}/><span>{question}</span></label>;
                })}
              </div>
            </div>)}
          </section>

          {selectedGuide && <section className="presentation-core-reference">
            <div className="eyebrow">SYMPTOM ANALYSIS REFERENCE</div><h3>Work through the symptom systematically</h3>
            <p>The general symptom guide below adds detail to the unit-specific questions. Adapt each item to the patient and avoid asking questions that are not clinically relevant.</p>
            <div className="presentation-core-steps">{selectedGuide.steps.map(([heading,body],index)=><details key={heading}><summary><span>{String(index+1).padStart(2,"0")}</span><strong>{heading}</strong><b>＋</b></summary><p>{body}</p></details>)}</div>
            <div className="presentation-reference-grid">
              <div><h4>Examination focus</h4><p>{selectedGuide.exam}</p></div>
              <div><h4>Differential considerations</h4><p>{selectedGuide.differentials}</p></div>
              <div><h4>Investigations to consider</h4><p>{selectedGuide.workup}</p></div>
              <div className="reference-pitfall"><h4>Common omissions</h4><p>{selectedGuide.pitfalls}</p></div>
            </div>
            {goodHistoryExamples[selectedGuide.id]&&<details className="presentation-example"><summary>View an illustrative history write-up</summary><p>{goodHistoryExamples[selectedGuide.id]}</p><small>Fictional teaching example. Never copy example findings into a real patient record unless they were actually elicited.</small></details>}
          </section>}

          <section className="presentation-redflags">
            <div><span className="eyebrow">SAFETY SCREEN</span><h3>Red flags — do not miss</h3><p>Ask directly when relevant. If an immediate threat is suspected, pause routine clerking and escalate according to local emergency procedures.</p></div>
            <ul>{selectedComplaint.redFlags.map((item,index)=><li key={index}>{item}</li>)}</ul>
          </section>

          <section className="presentation-exam-focus"><div className="eyebrow">AFTER THE HISTORY</div><h3>Examination priorities</h3><ul>{selectedComplaint.examinationFocus.map((item,index)=><li key={index}>{item}</li>)}</ul></section>
          <div className="presentation-footer-note">Educational framework only. Adapt to the patient’s age, pregnancy status, comorbidities, clinical setting and local guidance. Do not delay urgent assessment or escalation to complete this checklist.</div>
        </div>}
      </>}
    </div>
  );
}
