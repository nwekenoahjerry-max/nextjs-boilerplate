"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clinicalUnits } from "../lib/learning-content";
import { simulationCaseOptions, type SimulationCaseOption } from "../lib/simulation-cases";

type Turn = { role: "patient" | "student"; content: string };
type Material = { id: string; title: string; unit: string };
type ActiveCase = {
  id: string;
  title: string;
  complaint: string;
  name: string;
  age: string;
  sex: string;
  role: string;
  setting: string;
  openingMessage: string;
};
type CaseReview = {
  score: number;
  scoreLabel: string;
  feedback: string;
  strengths: string[];
  corrections: string[];
  redFlagsMissed: string[];
  clinicalReasoning: string;
  workingDiagnosis: string;
  differentialDiagnoses: string[];
  modelSummary: string;
  nextSteps: string[];
  safetyNote: string;
};

export default function ClinicalSimulation() {
  const [unit, setUnit] = useState("general-medicine");
  const [caseId, setCaseId] = useState("med-chest-pain");
  const [materialId, setMaterialId] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [activeCase, setActiveCase] = useState<ActiveCase | null>(null);
  const [conversation, setConversation] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [review, setReview] = useState<CaseReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"start" | "ask" | "review" | "">("");
  const [error, setError] = useState("");
  const [turnCount, setTurnCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const unitName = clinicalUnits.find(item => item.id === unit)?.name || unit;
  const unitCases = useMemo(() => simulationCaseOptions[unit] || [], [unit]);
  const selectedCase = unitCases.find(item => item.id === caseId) || unitCases[0];
  const unitMaterials = useMemo(() => materials.filter(item => item.unit === unit), [materials, unit]);

  useEffect(() => {
    fetch("/api/learning/materials", { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load your study library.");
        setMaterials(Array.isArray(data.materials) ? data.materials : []);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Could not load study materials."));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation, loading]);

  const resetSession = () => {
    setActiveCase(null);
    setConversation([]);
    setQuestion("");
    setReview(null);
    setTurnCount(0);
    setError("");
  };

  const changeUnit = (nextUnit: string) => {
    setUnit(nextUnit);
    setCaseId((simulationCaseOptions[nextUnit] || [])[0]?.id || "");
    setMaterialId("");
    resetSession();
  };

  const postSimulation = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/learning/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({ error: "The case service returned an unreadable response." }));
    if (!response.ok) throw new Error(data.error || "The case could not be continued.");
    return data;
  };

  const startCase = async () => {
    if (!selectedCase) return;
    setLoading(true);
    setLoadingMode("start");
    setError("");
    try {
      const data = await postSimulation({ unit, caseId: selectedCase.id, intent: "start", materialId: materialId || undefined });
      setActiveCase({
        ...(data.case as Omit<ActiveCase, "openingMessage">),
        openingMessage: data.openingMessage as string,
      });
      setConversation([{ role: "patient", content: data.openingMessage as string }]);
      setReview(null);
      setQuestion("");
      setTurnCount(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The case could not be started.");
    } finally {
      setLoading(false);
      setLoadingMode("");
    }
  };

  const askPatient = async () => {
    const prompt = question.trim();
    if (!activeCase || prompt.length < 2 || loading) return;
    setLoading(true);
    setLoadingMode("ask");
    setError("");
    setReview(null);
    try {
      const data = await postSimulation({
        unit,
        caseId: activeCase.id,
        intent: "ask",
        studentInput: prompt,
        history: conversation,
      });
      const reply = typeof data.patientReply === "string" ? data.patientReply : "I am not sure, doctor.";
      setConversation(current => [...current, { role: "student", content: prompt }, { role: "patient", content: reply }]);
      setQuestion("");
      setTurnCount(value => value + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The patient could not respond. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMode("");
    }
  };

  const requestReview = async () => {
    if (!activeCase || conversation.length < 2 || loading) return;
    setLoading(true);
    setLoadingMode("review");
    setError("");
    try {
      const data = await postSimulation({
        unit,
        caseId: activeCase.id,
        intent: "review",
        history: conversation,
        materialId: materialId || undefined,
      });
      const nextReview: CaseReview = {
        score: Number.isFinite(Number(data.score)) ? Math.max(0, Math.min(100, Number(data.score))) : 0,
        scoreLabel: typeof data.scoreLabel === "string" ? data.scoreLabel : "History-taking review",
        feedback: typeof data.feedback === "string" ? data.feedback : "",
        strengths: Array.isArray(data.strengths) ? data.strengths : [],
        corrections: Array.isArray(data.corrections) ? data.corrections : [],
        redFlagsMissed: Array.isArray(data.redFlagsMissed) ? data.redFlagsMissed : [],
        clinicalReasoning: typeof data.clinicalReasoning === "string" ? data.clinicalReasoning : "",
        workingDiagnosis: typeof data.workingDiagnosis === "string" ? data.workingDiagnosis : "",
        differentialDiagnoses: Array.isArray(data.differentialDiagnoses) ? data.differentialDiagnoses : [],
        modelSummary: typeof data.modelSummary === "string" ? data.modelSummary : "",
        nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
        safetyNote: typeof data.safetyNote === "string" ? data.safetyNote : "",
      };
      setReview(nextReview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The history could not be reviewed.");
    } finally {
      setLoading(false);
      setLoadingMode("");
    }
  };

  const renderList = (items: string[]) => items.length
    ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
    : <p className="simulation-muted">No additional points were recorded in this section.</p>;

  return (
    <div className="clinical-simulation-workspace">
      <div className="page-intro">
        <div className="eyebrow">CLINICAL ENCOUNTER PRACTICE</div>
        <h1>Patient interview simulation</h1>
        <p>Select a clinical unit and a case. Ask the patient questions in your own words, build the history step by step, then request a structured review of your clerking.</p>
      </div>

      {!activeCase ? (
        <section className="simulation-selector-card">
          <div className="simulation-selector-heading">
            <div>
              <div className="eyebrow">CASE LIBRARY</div>
              <h2>Choose your next patient</h2>
              <p>Cases are organised by clinical unit and presenting complaint. Select a specific case and interview the patient at your own pace.</p>
            </div>
            <span className="simulation-case-count">{unitCases.length} cases</span>
          </div>

          <div className="simulation-setup-controls">
            <label>Clinical unit
              <select value={unit} onChange={event => changeUnit(event.target.value)}>
                {clinicalUnits.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>Choose a case
              <select value={selectedCase?.id || ""} onChange={event => { setCaseId(event.target.value); resetSession(); }}>
                {unitCases.map(item => <option key={item.id} value={item.id}>{item.title} · {item.difficulty}</option>)}
              </select>
            </label>
            <label className="simulation-source-select">Study source (optional)
              <select value={materialId} onChange={event => setMaterialId(event.target.value)}>
                <option value="">Use the unit curriculum</option>
                {unitMaterials.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
          </div>

          <div className="simulation-case-options" aria-label="Available cases">
            {unitCases.map((item: SimulationCaseOption) => (
              <button type="button" key={item.id} className={caseId === item.id ? "simulation-case-option selected" : "simulation-case-option"} onClick={() => { setCaseId(item.id); resetSession(); }}>
                <span className="simulation-case-option-top"><span>{item.difficulty}</span><span aria-hidden="true">{caseId === item.id ? "✓" : "＋"}</span></span>
                <strong>{item.title}</strong>
                <small>{item.complaint}</small>
                <span className="simulation-case-option-setting">{item.setting}</span>
              </button>
            ))}
          </div>

          <div className="simulation-start-row">
            <p>{selectedCase ? <><strong>{selectedCase.complaint}</strong> · {selectedCase.setting}. The patient's history will be revealed only as you ask.</> : "Choose a case to begin."}</p>
            <button className="primary-button" onClick={startCase} disabled={loading || !selectedCase}>
              {loadingMode === "start" ? "Preparing case…" : "Start patient interview"} <span>→</span>
            </button>
          </div>
        </section>
      ) : (
        <div className="simulation-active">
          <section className="simulation-case-banner">
            <div className="simulation-patient-avatar" aria-hidden="true">{activeCase.name.split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase()}</div>
            <div className="simulation-patient-identity">
              <div className="eyebrow">{unitName.toUpperCase()} · FICTIONAL TEACHING CASE</div>
              <h2>{activeCase.name}, {activeCase.age}</h2>
              <p>{activeCase.sex} · {activeCase.role} · {activeCase.setting}</p>
            </div>
            <div className="simulation-case-banner-actions">
              <span className="simulation-case-status">Interview in progress</span>
              <button className="secondary-button" type="button" onClick={() => resetSession()}>Change case</button>
            </div>
          </section>

          <section className="simulation-conversation-card">
            <div className="simulation-conversation-heading">
              <div><span className="eyebrow">HISTORY TAKING</span><h3>{activeCase.complaint}</h3></div>
              <div className="simulation-turn-count"><strong>{turnCount}</strong><span>questions asked</span></div>
            </div>
            <div className="simulation-chat-log" role="log" aria-live="polite" aria-relevant="additions text">
              <div className="simulation-chat-intro">
                <span className="simulation-chat-person">{activeCase.role}</span>
                <p>{activeCase.openingMessage}</p>
              </div>
              {conversation.slice(1).map((turn, index) => (
                <div className={turn.role === "student" ? "simulation-chat-row student" : "simulation-chat-row patient"} key={index}>
                  {turn.role === "patient" && <span className="simulation-chat-person">{activeCase.name.split(" ")[0]}</span>}
                  <div className="simulation-chat-bubble">
                    <small>{turn.role === "student" ? "You" : activeCase.role}</small>
                    <p>{turn.content}</p>
                  </div>
                </div>
              ))}
              {loadingMode === "ask" && <div className="simulation-chat-row patient"><span className="simulation-chat-person">{activeCase.name.split(" ")[0]}</span><div className="simulation-chat-bubble"><small>{activeCase.role}</small><p className="simulation-typing">Thinking of an answer…</p></div></div>}
              <div ref={chatEndRef}/>
            </div>

            <form className="simulation-question-form" onSubmit={event => { event.preventDefault(); askPatient(); }}>
              <label htmlFor="patient-question">Ask the patient a question</label>
              <textarea id="patient-question" rows={2} value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); askPatient(); } }} placeholder="For example: When did the pain begin? Does it spread anywhere? What makes it worse?" disabled={loading}/>
              <div className="simulation-question-form-footer">
                <span>Ask in your own words. Press Enter to send or Shift + Enter for a new line.</span>
                <button className="primary-button" type="submit" disabled={loading || question.trim().length < 2}>{loadingMode === "ask" ? "Waiting for patient…" : "Send question"} <span>→</span></button>
              </div>
            </form>
          </section>

          {review && <section className="simulation-review-card">
            <div className="simulation-review-heading"><div><div className="eyebrow">SUPERVISOR'S REVIEW</div><h3>{review.scoreLabel || "History-taking review"}</h3></div><div className="simulation-review-score"><strong>{review.score}</strong><span>/100</span></div></div>
            <p className="simulation-review-feedback">{review.feedback}</p>
            <div className="simulation-review-grid">
              <div><h4>What you covered well</h4>{renderList(review.strengths)}</div>
              <div><h4>Areas to improve</h4>{renderList(review.corrections)}</div>
              <div className="simulation-review-warning"><h4>Safety questions not yet covered</h4>{renderList(review.redFlagsMissed)}</div>
              <div><h4>Clinical reasoning</h4><p>{review.clinicalReasoning || "No additional reasoning was recorded."}</p></div>
            </div>
            {review.workingDiagnosis && <div className="simulation-diagnosis-reveal"><span>LIKELY WORKING DIAGNOSIS</span><strong>{review.workingDiagnosis}</strong><p>{review.differentialDiagnoses.join(" · ")}</p></div>}
            {review.modelSummary && <div className="simulation-model-summary"><h4>Suggested history summary</h4><p>{review.modelSummary}</p></div>}
            {!!review.nextSteps.length && <div className="simulation-next-steps"><h4>What to do next</h4>{renderList(review.nextSteps)}</div>}
            {review.safetyNote && <p className="simulation-review-safety">{review.safetyNote}</p>}
            <div className="simulation-review-actions"><button className="secondary-button" onClick={() => setReview(null)}>Continue interview</button><button className="primary-button" onClick={() => resetSession()}>Finish and choose another case →</button></div>
          </section>}

          <div className="simulation-session-footer">
            <span>Fictional educational case · Do not enter identifiable real patient information</span>
            <button className="text-link" onClick={requestReview} disabled={loading || conversation.length < 2}>
              {loadingMode === "review" ? "Reviewing your history…" : "Review my history"} <span>→</span>
            </button>
          </div>
          {error && <p className="auth-error simulation-error">{error}</p>}
        </div>
      )}

      {error && !activeCase && <p className="auth-error simulation-error">{error}</p>}
      <p className="learning-note">Fictional educational practice only. Do not enter identifiable information from real patients. For real clinical encounters, use your institution's approved documentation process and seek appropriate supervision.</p>
    </div>
  );
}
