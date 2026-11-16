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
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0?: { transcript: string } }>;
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

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
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const [patientVoiceEnabled, setPatientVoiceEnabled] = useState(true);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sessionEndedRef = useRef(false);

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

  const speakPatient = (content: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !patientVoiceEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    const availableVoices = window.speechSynthesis.getVoices();
    const preferredVoice = availableVoices.find(voice => /^en(-|_)/i.test(voice.lang) && /female|woman|serena|susan|samantha|google uk english/i.test(`${voice.name} ${voice.lang}`))
      || availableVoices.find(voice => /^en(-|_)/i.test(voice.lang));
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.lang = preferredVoice?.lang || "en-GB";
    utterance.rate = 0.94;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const stopVoiceInput = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  };

  const startVoiceInput = () => {
    if (typeof window === "undefined") return;
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructorLike;
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceNotice("Voice input is not supported in this browser. You can still type your questions.");
      return;
    }
    if (isListening) {
      stopVoiceInput();
      return;
    }
    try {
      const recognition = new Recognition();
      recognition.lang = "en-GB";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = event => {
        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .filter(result => result.isFinal)
          .map(result => result[0]?.transcript || "")
          .join(" ")
          .trim();
        if (transcript) {
          setQuestion(current => `${current.trim()} ${transcript}`.trim());
          setVoiceNotice("Voice captured. Review the transcript, then send it to the patient.");
        }
      };
      recognition.onerror = event => {
        const messages: Record<string, string> = {
          "not-allowed": "Microphone access was blocked. Allow microphone access in your browser settings and try again.",
          "no-speech": "No speech was detected. Please try again or type your question.",
          "audio-capture": "No microphone was found. Connect a microphone or type your question.",
          "network": "Voice recognition could not connect. Please type your question instead.",
        };
        setVoiceNotice(messages[event.error] || "Voice input stopped. You can try again or type your question.");
      };
      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      setVoiceNotice("Listening… Speak clearly, then stop or pause. Your transcript will appear in the question box.");
    } catch {
      setIsListening(false);
      setVoiceNotice("The microphone could not be started. Check browser permissions and try again.");
    }
  };

  const printCasePresentation = () => {
    if (typeof window !== "undefined") {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      window.print();
    }
  };

  const resetSession = () => {
    sessionEndedRef.current = false;
    stopVoiceInput();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSessionEnded(false);
    setVoiceNotice("");
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
      sessionEndedRef.current = false;
      setSessionEnded(false);
      setActiveCase({
        ...(data.case as Omit<ActiveCase, "openingMessage">),
        openingMessage: data.openingMessage as string,
      });
      setConversation([{ role: "patient", content: data.openingMessage as string }]);
      setReview(null);
      setQuestion("");
      setTurnCount(0);
      if (patientVoiceEnabled) speakPatient(data.openingMessage as string);
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
      if (sessionEndedRef.current) return;
      setConversation(current => [...current, { role: "student", content: prompt }, { role: "patient", content: reply }]);
      setQuestion("");
      setTurnCount(value => value + 1);
      if (patientVoiceEnabled) speakPatient(reply);
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

  const endSession = async () => {
    if (!activeCase) return;
    sessionEndedRef.current = true;
    setSessionEnded(true);
    setQuestion("");
    setVoiceNotice("");
    stopVoiceInput();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    if (conversation.length >= 2 && !loading && !review) await requestReview();
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
              <span className={sessionEnded ? "simulation-case-status ended" : "simulation-case-status"}>{sessionEnded ? "Session ended" : "Interview in progress"}</span>
              <button className="secondary-button" type="button" onClick={printCasePresentation}>Print case</button>
              {!sessionEnded && <button className="simulation-end-button" type="button" onClick={endSession}>End session</button>}
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
                <div className="simulation-chat-message-meta"><span className="simulation-chat-person">{activeCase.role}</span><button className="simulation-play-voice" type="button" onClick={() => speakPatient(activeCase.openingMessage)} disabled={!patientVoiceEnabled}>▶ Listen</button></div>
                <p>{activeCase.openingMessage}</p>
              </div>
              {conversation.slice(1).map((turn, index) => (
                <div className={turn.role === "student" ? "simulation-chat-row student" : "simulation-chat-row patient"} key={index}>
                  {turn.role === "patient" && <span className="simulation-chat-person">{activeCase.name.split(" ")[0]}</span>}
                  <div className="simulation-chat-bubble">
                    <div className="simulation-chat-message-meta"><small>{turn.role === "student" ? "You" : activeCase.role}</small>{turn.role === "patient" && <button className="simulation-play-voice" type="button" onClick={() => speakPatient(turn.content)} disabled={!patientVoiceEnabled}>▶ Listen</button>}</div>
                    <p>{turn.content}</p>
                  </div>
                </div>
              ))}
              {loadingMode === "ask" && <div className="simulation-chat-row patient"><span className="simulation-chat-person">{activeCase.name.split(" ")[0]}</span><div className="simulation-chat-bubble"><small>{activeCase.role}</small><p className="simulation-typing">Thinking of an answer…</p></div></div>}
              <div ref={chatEndRef}/>
            </div>

            {!sessionEnded ? <form className="simulation-question-form" onSubmit={event => { event.preventDefault(); askPatient(); }}>
              <label htmlFor="patient-question">Ask or speak to the patient</label>
              <textarea id="patient-question" rows={3} value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); askPatient(); } }} placeholder="Type a question, or use the microphone to ask it aloud…" disabled={loading}/>
              <div className="simulation-voice-controls">
                <button className={isListening ? "simulation-voice-button listening" : "simulation-voice-button"} type="button" onClick={startVoiceInput} disabled={loading}>
                  <span aria-hidden="true">{isListening ? "■" : "🎙"}</span> {isListening ? "Stop listening" : "Speak your question"}
                </button>
                <button className={patientVoiceEnabled ? "simulation-patient-voice-toggle active" : "simulation-patient-voice-toggle"} type="button" onClick={() => { if (patientVoiceEnabled && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); setPatientVoiceEnabled(value => !value); }} aria-pressed={patientVoiceEnabled}>
                  {patientVoiceEnabled ? "Patient voice: on" : "Patient voice: off"}
                </button>
                <span>Speak naturally. Your words are transcribed for review before sending.</span>
              </div>
              {voiceNotice && <p className="simulation-voice-notice" role="status">{voiceNotice}</p>}
              <div className="simulation-question-form-footer">
                <span>Type or speak your question. Press Enter to send or Shift + Enter for a new line.</span>
                <button className="primary-button" type="submit" disabled={loading || question.trim().length < 2}>{loadingMode === "ask" ? "Waiting for patient…" : "Send question"} <span>→</span></button>
              </div>
            </form> : <div className="simulation-ended-panel">
              <div><span className="eyebrow">SESSION ENDED</span><h3>Your interview has ended</h3><p>{review ? "Your structured review is ready below. Print the case presentation whenever you are ready." : conversation.length < 2 ? "You ended the interview before enough questions were asked for a structured review. You can still print the case and transcript." : loading ? "Your structured review is being prepared." : "The interview has ended. You can print the case presentation or generate a review from the conversation."}</p></div>
              <div className="simulation-ended-actions">
                <button className="secondary-button" type="button" onClick={() => { sessionEndedRef.current = false; setSessionEnded(false); }}>Continue interview</button>
                <button className="primary-button" type="button" onClick={printCasePresentation}>Print case presentation</button>
              </div>
            </div>}
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
            <div className="simulation-review-actions"><button className="secondary-button" onClick={printCasePresentation}>Print case presentation</button><button className="secondary-button" onClick={() => { sessionEndedRef.current = false; setSessionEnded(false); setReview(null); }}>Continue interview</button><button className="primary-button" onClick={() => resetSession()}>Finish and choose another case →</button></div>
          </section>}

          <div className="simulation-session-footer">
            <span>Fictional educational case · Do not enter identifiable real patient information</span>
            <div className="simulation-footer-actions"><button className="secondary-button" type="button" onClick={printCasePresentation}>Print case</button><button className="text-link" type="button" onClick={requestReview} disabled={loading || conversation.length < 2 || Boolean(review)}>
              {loadingMode === "review" ? "Reviewing your history…" : review ? "Review complete" : "Review my history"} <span>→</span>
            </button></div>
          </div>
          {error && <p className="auth-error simulation-error">{error}</p>}
          <section className="simulation-print-report" aria-hidden="true">
            <header><div className="print-brand">CLERKME</div><div>Clinical case presentation</div><small>Generated {new Date().toLocaleString("en-GB")}</small></header>
            <h1>{activeCase.complaint}</h1>
            <h2>Patient details</h2>
            <dl className="simulation-print-details"><div><dt>Patient</dt><dd>{activeCase.name}</dd></div><div><dt>Age</dt><dd>{activeCase.age}</dd></div><div><dt>Sex</dt><dd>{activeCase.sex}</dd></div><div><dt>Informant / role</dt><dd>{activeCase.role}</dd></div><div><dt>Clinical unit</dt><dd>{unitName}</dd></div><div><dt>Setting</dt><dd>{activeCase.setting}</dd></div></dl>
            <h2>Interview transcript</h2>
            <ol className="simulation-print-transcript">{conversation.map((turn, index) => <li key={index}><strong>{turn.role === "student" ? "Student" : activeCase.name}</strong><p>{turn.content}</p></li>)}</ol>
            {review ? <section className="simulation-print-review"><h2>Structured clerking review</h2><p><strong>Score:</strong> {review.score}/100 · {review.scoreLabel}</p><p>{review.feedback}</p><h3>What was covered well</h3><ul>{review.strengths.map((item,index)=><li key={index}>{item}</li>)}</ul><h3>Areas to improve</h3><ul>{review.corrections.map((item,index)=><li key={index}>{item}</li>)}</ul><h3>Safety questions not yet covered</h3><ul>{review.redFlagsMissed.map((item,index)=><li key={index}>{item}</li>)}</ul>{review.clinicalReasoning && <><h3>Clinical reasoning</h3><p>{review.clinicalReasoning}</p></>}{review.workingDiagnosis && <><h3>Working diagnosis</h3><p>{review.workingDiagnosis}</p></>}{review.differentialDiagnoses.length>0 && <><h3>Differential diagnoses</h3><ul>{review.differentialDiagnoses.map((item,index)=><li key={index}>{item}</li>)}</ul></>}{review.modelSummary && <><h3>Suggested case summary</h3><p>{review.modelSummary}</p></>}{review.nextSteps.length>0 && <><h3>Suggested next steps</h3><ul>{review.nextSteps.map((item,index)=><li key={index}>{item}</li>)}</ul></>}{review.safetyNote && <p>{review.safetyNote}</p>}</section> : <p className="simulation-print-note">A structured review was not generated for this interview.</p>}
            <footer>Fictional educational case. This report is for learning and presentation practice only; verify all clinical information and follow local supervision and documentation requirements.</footer>
          </section>
        </div>
      )}

      {error && !activeCase && <p className="auth-error simulation-error">{error}</p>}
      <p className="learning-note">Fictional educational practice only. Do not enter identifiable information from real patients. For real clinical encounters, use your institution's approved documentation process and seek appropriate supervision.</p>
    </div>
  );
}
