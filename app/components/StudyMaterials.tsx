"use client";

import { useRef, useState, type FormEvent } from "react";
import { extractStudyFile } from "../../lib/file-text";

type Summary = {
  title: string;
  overview: string;
  learningObjectives: string[];
  keyConcepts: { heading: string; explanation: string }[];
  stepByStep: string[];
  highYieldPoints: string[];
  clinicalApplications: string[];
  examFocus: string[];
  memoryAids: string[];
  gapsAndCautions: string[];
};
type Message = { role: "student" | "tutor"; content: string };
const list = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export default function StudyMaterials({ isAuthenticated }: { isAuthenticated: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [sourceText, setSourceText] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const chooseFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(""); setStatus(""); setSummary(null); setMessages([]); setSourceText(""); setFileNames([]);
    try {
      const extracted: string[] = [];
      const names: string[] = [];
      let total = 0;
      for (const file of Array.from(files)) {
        const result = await extractStudyFile(file);
        const remaining = 30000 - total;
        if (remaining <= 0) break;
        const text = result.text.slice(0, remaining);
        extracted.push("SOURCE DOCUMENT: " + result.name + "\n" + text);
        names.push(result.name);
        total += text.length;
      }
      if (!extracted.length || total < 100) throw new Error("No readable study text was found in the selected files.");
      setSourceText(extracted.join("\n\n--- NEXT DOCUMENT ---\n\n"));
      setFileNames(names);
      setStatus("Read " + total.toLocaleString() + " characters from " + names.length + " document(s). Ready to organise.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The selected file could not be read.");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const summarise = async () => {
    if (!sourceText || busy) return;
    if (!isAuthenticated) { setError("Sign in to use AI study tools."); return; }
    setBusy(true); setError(""); setStatus("Reading your material and preparing a structured study guide…"); setSummary(null); setMessages([]);
    try {
      const response = await fetch("/api/learning/summarise", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ sourceText, sourceTitle: fileNames.join(", ") || "Uploaded study material" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The material could not be summarised.");
      setSummary(data.summary as Summary);
      setStatus("Your summary is ready. Ask questions about the uploaded source below.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The material could not be summarised."); setStatus("");
    } finally { setBusy(false); }
  };

  const ask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || !sourceText || !summary || busy) return;
    if (!isAuthenticated) { setError("Sign in to ask the AI tutor questions."); return; }
    const previous = messages.slice(-10);
    setMessages(current => [...current, { role: "student", content: prompt }]);
    setQuestion(""); setBusy(true); setError("");
    try {
      const response = await fetch("/api/learning/answer", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ sourceText, summary, question: prompt, conversation: previous })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The AI tutor could not answer.");
      setMessages(current => [...current, { role: "tutor", content: String(data.answer || "I could not find a reliable answer in the uploaded material.") }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The AI tutor could not answer.");
    } finally { setBusy(false); }
  };

  const clear = () => {
    setFileNames([]); setSourceText(""); setSummary(null); setMessages([]); setQuestion(""); setError(""); setStatus("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const copySummary = async () => {
    if (!summary) return;
    const text = [
      summary.title, summary.overview, "Learning objectives", ...list(summary.learningObjectives),
      "Key concepts", ...(summary.keyConcepts || []).map(item => item.heading + ": " + item.explanation),
      "Step-by-step explanation", ...list(summary.stepByStep), "High-yield points", ...list(summary.highYieldPoints),
      "Clinical applications", ...list(summary.clinicalApplications), "Examination focus", ...list(summary.examFocus),
      "Memory aids", ...list(summary.memoryAids), "Gaps and cautions", ...list(summary.gapsAndCautions)
    ].filter(Boolean).join("\n\n");
    try { await navigator.clipboard.writeText(text); setStatus("Study summary copied to your clipboard."); }
    catch { setError("Clipboard access is unavailable. You can still select and copy the summary."); }
  };

  return <section className="study-materials-workspace">
    <div className="study-materials-intro"><div><span className="eyebrow">YOUR PERSONAL STUDY LIBRARY</span><h1>Study materials & AI tutor</h1><p>Upload lectures, clerkship notes and revision documents. ClerkMe turns them into clear, structured study notes and answers questions using the source you supplied.</p></div><div className="study-materials-mark" aria-hidden="true">✦</div></div>

    <div className="study-upload-card">
      <div className="study-upload-copy"><span className="study-upload-icon">⇧</span><div><h2>Upload your materials</h2><p>Select one or more text-based documents. Your browser extracts the readable text before the AI organises it.</p></div></div>
      <label className="study-dropzone"><input ref={fileRef} type="file" multiple accept=".pptx,.pdf,.docx,.txt,.md,.csv" onChange={event => void chooseFiles(event.target.files)} /><span className="study-dropzone-symbol">＋</span><strong>{fileNames.length ? fileNames.length + " document(s) ready" : "Choose files from your device"}</strong><small>PDF · PPTX · DOCX · TXT · Markdown · CSV · up to 20 MB per file</small><span className="study-browse-link">Browse files</span></label>
      {fileNames.length > 0 && <div className="study-file-list">{fileNames.map(name => <span key={name}>▤ {name}</span>)}</div>}
      <div className="study-upload-actions"><p>Scanned/image-only PDFs may not contain selectable text. Original files are not permanently saved by this tool; extracted text is sent for AI processing when you request a summary.</p><div><button className="secondary-button" type="button" onClick={clear} disabled={busy || (!sourceText && !summary)}>Clear</button><button className="primary-button" type="button" onClick={() => void summarise()} disabled={busy || !sourceText || !isAuthenticated}>{busy ? "Organising…" : "Organise & summarise"} <span>→</span></button></div></div>
      {!isAuthenticated && <p className="study-auth-note">Sign in is required for AI summarisation and question answering. <a href="/login">Sign in with Google</a>.</p>}
      {status && <p className="study-status" role="status">{status}</p>}{error && <p className="auth-error" role="alert">{error}</p>}
    </div>

    {summary && <div className="study-results">
      <div className="study-results-heading"><div><span className="eyebrow">STRUCTURED STUDY NOTES</span><h2>{summary.title || fileNames.join(", ")}</h2><p>Prepared from: {fileNames.join(", ")}</p></div><button className="secondary-button" type="button" onClick={() => void copySummary()}>Copy study guide</button></div>
      <section className="study-overview-card"><span className="study-section-kicker">THE TOPIC IN SIMPLE TERMS</span><p>{summary.overview}</p></section>
      <div className="study-summary-grid">
        <section className="study-summary-card"><h3>What you should learn</h3><ol>{list(summary.learningObjectives).map((item, i) => <li key={i}>{item}</li>)}</ol></section>
        <section className="study-summary-card"><h3>Key concepts explained</h3><div className="study-concepts">{(summary.keyConcepts || []).map((item, i) => <article key={i}><strong>{item.heading}</strong><p>{item.explanation}</p></article>)}</div></section>
        <section className="study-summary-card study-summary-wide"><h3>Step-by-step explanation</h3><ol>{list(summary.stepByStep).map((item, i) => <li key={i}>{item}</li>)}</ol></section>
        <section className="study-summary-card"><h3>High-yield points</h3><ul>{list(summary.highYieldPoints).map((item, i) => <li key={i}>{item}</li>)}</ul></section>
        <section className="study-summary-card"><h3>Clinical applications</h3><ul>{list(summary.clinicalApplications).map((item, i) => <li key={i}>{item}</li>)}</ul></section>
        <section className="study-summary-card"><h3>Examination focus</h3><ul>{list(summary.examFocus).map((item, i) => <li key={i}>{item}</li>)}</ul></section>
        <section className="study-summary-card"><h3>Memory aids</h3><ul>{list(summary.memoryAids).map((item, i) => <li key={i}>{item}</li>)}</ul></section>
        <section className="study-summary-card study-cautions"><h3>Gaps, ambiguity and cautions</h3><ul>{list(summary.gapsAndCautions).map((item, i) => <li key={i}>{item}</li>)}</ul><p>Where the source is silent or unclear, the tutor should say so rather than invent a fact or guideline.</p></section>
      </div>
      <section className="study-tutor-card"><div className="study-tutor-heading"><div><span className="eyebrow">SOURCE-GROUNDED QUESTION & ANSWER</span><h2>Ask about your uploaded material</h2><p>Ask for clarification, examples, comparisons, clinical applications or exam-style explanations.</p></div><span className="study-tutor-icon">✧</span></div>
        <div className="study-chat-history" aria-live="polite">{messages.length === 0 && <div className="study-chat-empty"><strong>Your AI tutor is ready.</strong><p>Try: “Explain this in simpler terms”, “Compare the key concepts” or “Give me a clinical example from these notes”.</p></div>}{messages.map((message, i) => <article className={"study-chat-message " + message.role} key={i}><span>{message.role === "student" ? "YOU" : "CLERKME TUTOR"}</span><p>{message.content}</p></article>)}{busy && <article className="study-chat-message tutor"><span>CLERKME TUTOR</span><p className="study-thinking">Reviewing your source material…</p></article>}</div>
        <form className="study-question-form" onSubmit={ask}><textarea value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a question about your uploaded material…" rows={2} maxLength={900} disabled={!isAuthenticated || busy} /><button className="primary-button" type="submit" disabled={!isAuthenticated || busy || !question.trim()}>Ask tutor <span>→</span></button></form>
      </section>
    </div>}
  </section>;
}
