"use client";

import { useMemo, useState } from "react";
import { clinicalUnits, caseGuides } from "../lib/learning-content";
import { goodHistoryExamples } from "../lib/good-history";
import { coreClerkingSections, unitClerkingFrameworks, type GuideSection } from "../lib/unit-clerking";

const guideMap: Record<string, string[]> = {
  "general-medicine": ["pain","fever","cough","abdominal-pain","headache","dyspnoea","vomiting","diarrhoea","seizure","weakness","jaundice","urinary"],
  surgery: ["pain","abdominal-pain","trauma","vomiting","jaundice"],
  paediatrics: ["pain","fever","cough","abdominal-pain","vomiting","diarrhoea","seizure","dyspnoea"],
  "obstetrics-gynaecology": ["pain","fever","pv-bleeding","vaginal-discharge","headache","vomiting"],
  emergency: ["pain","fever","dyspnoea","seizure","trauma","weakness","vomiting"],
  psychiatry: ["headache","weakness"],
  "community-medicine": ["fever","cough","diarrhoea","pain"],
  orthopaedics: ["pain","trauma","weakness"]
};

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
  const [view,setView] = useState<"pathway"|"presentations">("pathway");
  const [selectedGuideId,setSelectedGuideId] = useState<string|null>(null);
  const framework = unitClerkingFrameworks[unit] || unitClerkingFrameworks["general-medicine"];
  const unitName = clinicalUnits.find(item=>item.id===unit)?.name || framework.title;
  const relevantGuides = useMemo(
    ()=>caseGuides.filter(item=>(guideMap[unit] || []).includes(item.id)),
    [unit]
  );
  const selectedGuide = caseGuides.find(item=>item.id===selectedGuideId);

  return (
    <div className="clinical-guides-workspace">
      <div className="page-intro">
        <div className="eyebrow">UNIT-BASED CLINICAL LEARNING</div>
        <h1>Clinical clerking guides</h1>
        <p>Follow the full clerking sequence from patient approach and biodata to final case presentation. Each unit adds its own specialist history, examination and safety requirements.</p>
      </div>

      <div className="learning-toolbar unit-guide-toolbar">
        <label>My current clinical unit
          <select value={unit} onChange={event=>{setUnit(event.target.value);setSelectedGuideId(null);}}>
            {clinicalUnits.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <p>{framework.overview}</p>
      </div>

      <div className="unit-guide-tabs">
        <button className={view==="pathway"?"active":""} onClick={()=>{setView("pathway");setSelectedGuideId(null);}}>Complete clerking pathway</button>
        <button className={view==="presentations"?"active":""} onClick={()=>{setView("presentations");setSelectedGuideId(null);}}>Presenting complaints</button>
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
        <div className="page-intro presentation-guide-intro">
          <div className="eyebrow">{framework.title.toUpperCase()} · PRESENTATION-BASED GUIDES</div>
          <h2>Clerk common presentations</h2>
          <p>Choose a presentation for focused symptom questions, an examination plan, differential diagnoses, investigations and common omissions.</p>
        </div>
        {!selectedGuide && <div className="guide-grid">
          {relevantGuides.map((item,index)=><button className="guide-card" key={item.id} onClick={()=>setSelectedGuideId(item.id)}>
            <span className="resource-number">{String(index+1).padStart(2,"0")} · {item.group}</span>
            <h3>{item.title}</h3><p>{item.intro}</p><span className="card-action">Open focused guide →</span>
          </button>)}
        </div>}
        {selectedGuide && <div className="guide-detail">
          <button className="text-link" onClick={()=>setSelectedGuideId(null)}>← Back to {unitName} presentations</button>
          <div className="page-intro"><div className="eyebrow">{selectedGuide.group.toUpperCase()} · CASE-BASED GUIDE</div><h2>How to clerk: {selectedGuide.title}</h2><p>{selectedGuide.intro}</p></div>
          <section className="guide-section"><h3>Focused history — questions to ask</h3>
            {selectedGuide.steps.map(([heading,body],index)=><div className="guide-step" key={heading}><strong>{String(index+1).padStart(2,"0")} · {heading}</strong><p>{body}</p></div>)}
          </section>
          <section className="guide-section good-history-example"><h3>Illustrative clinical history write-up</h3><p>{goodHistoryExamples[selectedGuide.id] || "Write the history chronologically, preserving the patient's account, timing, relevant positive symptoms and important negative findings."}</p><small>Fictional teaching example. Never copy example findings into a real patient record unless they were actually elicited.</small><button className="text-link" onClick={()=>navigator.clipboard?.writeText(goodHistoryExamples[selectedGuide.id]||"")}>Copy example prose</button></section>
          <section className="guide-section"><h3>Examination</h3><p>{selectedGuide.exam}</p></section>
          <section className="guide-section"><h3>Differential diagnosis</h3><p>{selectedGuide.differentials}</p></section>
          <section className="guide-section"><h3>Investigations and initial approach</h3><p>{selectedGuide.workup}</p></section>
          <section className="guide-section guide-pitfalls"><h3>Common omissions and safety points</h3><p>{selectedGuide.pitfalls}</p></section>
          <p className="guide-disclaimer">Educational framework only. Adapt to the patient, local protocols, available resources and senior clinical advice.</p>
        </div>}
      </>}
    </div>
  );
}
