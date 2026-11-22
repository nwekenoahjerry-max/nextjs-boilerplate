"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clinicalUnits, questionBank } from "../lib/learning-content";
import { extractStudyFile, STUDY_FILE_ACCEPT, STUDY_FILE_TYPES } from "../lib/file-text";
import ClinicalGuides from "./clinical-guides";
import MaterialsPanel from "./materials-panel";
import VideoLibraryPanel from "./video-library-panel";
import FocusMusicPlayer from "./focus-music-player";
import AdaptiveFlightGame from "./adaptive-flight-game";
import LearningQuestionBank from "./learning-question-bank";
import ClinicalSimulation from "./clinical-simulation";
import InstallAppButton from "./install-app-button";
import ClerkMeBrand from "../components/clerkme-brand";
import { unitClerkingFrameworks } from "../lib/unit-clerking";

const navItems = [
  ["Home", "overview", "home"],
  ["New clerking", "clerking", "file-plus"],
  ["My patients", "patients", "users"],
  ["Clinical guides", "guides", "book-check"],
  ["Clinical simulation", "simulation", "stethoscope"],
  ["Study", "study", "book-open"],
  ["My materials", "materials", "folder-open"],
  ["Video library", "videos", "play-square"],
  ["OSCE & Viva", "osce", "clipboard-list"],
  ["Question bank", "qbank", "list-checks"],
  ["Flight Academy", "game", "plane"],
  ["Account", "you", "user-round"],
];

const workspaceIconShapes: Record<string, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></>,
  "file-plus": <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/><path d="M12 12v6"/><path d="M9 15h6"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  "book-check": <><path d="M12 7v14"/><path d="M3 18V5a2 2 0 0 1 2-2h4a3 3 0 0 1 3 3 3 3 0 0 1 3-3h4a2 2 0 0 1 2 2v13"/><path d="M3 18h6a3 3 0 0 1 3 3"/><path d="M21 18h-6a3 3 0 0 0-3 3"/><path d="m15 10 1.5 1.5L19 9"/></>,
  stethoscope: <><path d="M6 3v5a5 5 0 0 0 10 0V3"/><path d="M4 3h4M14 3h4"/><path d="M11 13v2a5 5 0 0 0 10 0v-1"/><circle cx="20" cy="12" r="2"/><path d="M11 18v2a3 3 0 0 0 6 0v-1"/></>,
  "book-open": <><path d="M12 7v14"/><path d="M3 18V5a2 2 0 0 1 2-2h4a3 3 0 0 1 3 3 3 3 0 0 1 3-3h4a2 2 0 0 1 2 2v13"/><path d="M3 18h6a3 3 0 0 1 3 3"/><path d="M21 18h-6a3 3 0 0 0-3 3"/></>,
  "folder-open": <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v1"/><path d="M3 17V7"/><path d="M2 17l2-6a2 2 0 0 1 2-1h15a1 1 0 0 1 1 1l-2 7a2 2 0 0 1-2 1H4a2 2 0 0 1-2-2Z"/></>,
  "play-square": <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m10 8 6 4-6 4z"/></>,
  "clipboard-list": <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M8 10h8M8 14h8M8 18h5"/></>,
  "list-checks": <><path d="m3 6 2 2 3-3"/><path d="M11 6h10"/><path d="m3 12 2 2 3-3"/><path d="M11 12h10"/><path d="m3 18 2 2 3-3"/><path d="M11 18h10"/></>,
  plane: <><path d="m12 2 4 8 6 3v2l-7-1-2 8h-2l-2-8-7 1v-2l6-3z"/></>,
  "user-round": <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/></>,
};

function WorkspaceIcon({ name, className }: { name: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {workspaceIconShapes[name] || workspaceIconShapes.home}
  </svg>;
}

const templates = [
  { id: "general-medicine", title: "General medical clerking", detail: "Presenting complaint, HPC, PMH, drug and social history", tag: "MEDICINE", icon: "✚" },
  { id: "paediatrics", title: "Paediatric clerking", detail: "Birth history, development, immunisation and nutrition", tag: "PAEDIATRICS", icon: "♧" },
  { id: "obstetrics-gynaecology", title: "Obstetric and gynaecological history", detail: "Antenatal, intrapartum, gynaecological and obstetric history", tag: "OBSTETRICS & GYNAECOLOGY", icon: "♡" },
  { id: "surgery", title: "Surgical clerking", detail: "Surgical history, examination and peri-operative review", tag: "SURGERY", icon: "⌁" },
];


const publicStudyFeatures = [
  {number:"01",title:"Original source material",description:"Keep your uploaded lecture beside the study guide. Open the source file in its own viewer and return to the material you are revising.",detail:"Your lecture stays part of the workflow"},
  {number:"02",title:"Ask your material",description:"Ask questions about a selected upload. ClerkME prioritises source-supported explanations and distinguishes additional context from what your document says.",detail:"A tutor grounded in your material"},
  {number:"03",title:"SBA generation and question bank",description:"Generate distinct single-best-answer questions from your lecture, then practise them alongside the unit's ClerkME core questions with explanations and feedback.",detail:"Lecture-based and core questions"},
  {number:"04",title:"Visual and memory tools",description:"Strengthen recall with comparison tables, flowcharts, mnemonics, memory hooks, illustrated concepts, exam-focus notes and active-recall prompts.",detail:"Understand it, then remember it"},
];

const publicClinicalFeatures = [
  {number:"01",title:"Structured clinical clerking",description:"Work through patient history, examination, assessment, differential diagnoses and management using specialty-aware templates and a rough-note organiser.",detail:"A clearer route from history to presentation"},
  {number:"02",title:"Presenting-complaint guides",description:"Search clinical presentations and work through focused questions, symptom analysis, red flags, examination priorities, differentials and investigations.",detail:"Guided clinical reasoning across 8 units"},
  {number:"03",title:"Interactive clinical simulation",description:"Interview fictional patients by text or voice, then review your score, strengths, corrections, missed red flags, clinical reasoning and next steps.",detail:"Practise the conversation, not just the facts"},
  {number:"04",title:"OSCE and Viva practice",description:"Use unit-based oral and practical examination prompts, formulate your response, then reveal examiner-style teaching points and explanations.",detail:"Focused practice for clinical examinations"},
  {number:"05",title:"Flight Academy",description:"Turn unit and uploaded-material questions into a question-led flight game. Correct answers build speed, while missions progress automatically.",detail:"Revision with momentum"},
  {number:"06",title:"Private cases and learning activity",description:"Keep your learning cases in your account and follow your current streak, personal best, active days and weekly study check-ins.",detail:"Your work and progress in one workspace"},
];

function PublicLanding() {
  const [sampleAnswer, setSampleAnswer] = useState<number | null>(null);
  const sampleOptions = [
    "Ruptured ectopic pregnancy",
    "Threatened miscarriage",
    "Pelvic inflammatory disease",
    "Ovarian torsion",
  ];

  return (
    <main className="public-landing clerkme-public-home">
      <header className="public-header">
        <ClerkMeBrand caption="AI CLINICAL LEARNING & EXAM PREP" className="public-brand"/>
        <nav aria-label="Public navigation">
          <a href="#study-tools">Study tools</a>
          <a href="#youtube-library">YouTube library</a>
          <a href="#clinical-practice">Clinical practice</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <div className="public-header-actions">
          <a className="public-header-signin" href="/login">Sign in <span>→</span></a>
          <a className="public-header-start" href="/login">Get started</a>
        </div>
      </header>

      <section className="public-hero">
        <div className="public-hero-copy">
          <span className="public-eyebrow"><i/> AI-POWERED STUDY & CLINICAL PRACTICE</span>
          <h1>Learn with purpose.<br/><em>Practise with confidence.</em></h1>
          <p>
            ClerkME brings detailed lecture-based study guides and SBAs together with structured clinical clerking, fictional-patient simulation and OSCE/Viva practice.
            Discover related YouTube lectures, watch supported videos inside the app, and keep your clinical learning in one connected workspace.
          </p>
          <div className="public-hero-actions">
            <a className="public-primary-cta" href="/login">Get started with ClerkME <span>→</span></a>
            <a className="public-secondary-cta" href="#study-tools">Explore the study tools</a>
          </div>
          <div className="public-hero-proof" aria-label="ClerkME highlights">
            <div><strong>8</strong><span>clinical units</span></div>
            <div><strong>AI</strong><span>source-based study support</span></div>
            <div><strong>1</strong><span>connected learning space</span></div>
          </div>
        </div>

        <div className="public-hero-demo-wrap">
          <div className="public-demo-heading">
            <span>CLERKME QUICK PRACTICE</span>
            <strong>Try a sample SBA</strong>
          </div>
          <article className="public-demo-card" aria-label="Sample single-best-answer question">
            <div className="public-demo-top">
              <span className="public-demo-live"><i/> INTERACTIVE QUESTION</span>
              <span className="public-demo-no-login">No sign-in needed</span>
            </div>
            <div className="public-demo-meta">OBSTETRICS & GYNAECOLOGY <span>·</span> SINGLE BEST ANSWER</div>
            <h2>
              A 26-year-old woman presents with 7 weeks of amenorrhoea, lower abdominal pain and vaginal bleeding.
              She is dizzy and hypotensive. What is the most likely diagnosis?
            </h2>
            <div className="public-demo-options">
              {sampleOptions.map((option, index) => (
                <button
                  type="button"
                  key={option}
                  className={[
                    "public-demo-option",
                    sampleAnswer === index ? "is-selected" : "",
                    sampleAnswer !== null && index === 0 ? "is-correct" : "",
                    sampleAnswer !== null && sampleAnswer === index && index !== 0 ? "is-incorrect" : "",
                  ].filter(Boolean).join(" ")}
                  aria-pressed={sampleAnswer === index}
                  disabled={sampleAnswer !== null}
                  onClick={() => setSampleAnswer(index)}
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  <strong>{option}</strong>
                  <b>{sampleAnswer !== null && index === 0 ? "✓" : sampleAnswer === index && index !== 0 ? "×" : ""}</b>
                </button>
              ))}
            </div>
            {sampleAnswer !== null && (
              <div className={sampleAnswer === 0 ? "public-demo-feedback is-correct" : "public-demo-feedback is-review"} role="status">
                <strong>{sampleAnswer === 0 ? "Correct — well done." : "Not quite. Review the key clues."}</strong>
                <p>
                  Amenorrhoea, abdominal pain, vaginal bleeding and haemodynamic instability are red flags for a
                  ruptured ectopic pregnancy. This is a time-critical emergency requiring immediate resuscitation
                  and urgent senior/obstetric assessment.
                </p>
                <button type="button" onClick={() => setSampleAnswer(null)}>Try again <span>↻</span></button>
              </div>
            )}
            <div className="public-demo-footer">
              <span>ACTIVE RECALL</span>
              <span>LEARN · TEST · IMPROVE</span>
            </div>
          </article>
          <p className="public-demo-disclaimer">Example revision question for learning. ClerkME does not replace clinical judgement or supervision.</p>
        </div>
      </section>

      <section className="public-feature-section public-study-section" id="study-tools">
        <div className="public-section-heading">
          <div>
            <span className="public-eyebrow">YOUR LECTURES, TURNED INTO A STUDY SYSTEM</span>
            <h2>Go beyond reading. Understand, revise and test what you have learned.</h2>
          </div>
          <p>ClerkME connects your original learning resources to detailed explanations, question practice and video support.</p>
        </div>
        <div className="public-spotlight-grid">
          <article className="public-spotlight-card public-spotlight-study">
            <div className="public-spotlight-copy">
              <span className="public-spotlight-kicker">01 / LECTURE-TO-REVISION</span>
              <h3>One upload. A structured, exam-focused study guide.</h3>
              <p>Upload a PDF, PowerPoint, Word document or other supported study resource. ClerkME builds a detailed study guide from the material instead of giving you a wall of unstructured text.</p>
              <ul>
                <li>Topic-by-topic explanations and learning objectives</li>
                <li>Diagnosis patterns, red flags, investigations and management tables</li>
                <li>Comparison tables, mnemonics, memory hooks and recall prompts</li>
                <li>Distinct SBA questions generated from the uploaded source</li>
              </ul>
              <a href="/login" className="public-spotlight-link">Explore My Study Materials <span>→</span></a>
            </div>
            <div className="public-spotlight-visual public-study-visual" aria-label="Illustrative study guide preview">
              <div className="public-visual-window">
                <div className="public-visual-window-top"><span className="public-window-dots"><i/><i/><i/></span><span>CLERKME · STUDY GUIDE</span><b>READY</b></div>
                <div className="public-visual-document">
                  <span className="public-visual-label">HIGH-YIELD POINTS</span>
                  <strong>Understand the pattern. Know the next step.</strong>
                  <div className="public-visual-row"><span>01</span><div><b>Clinical presentation</b><small>Key symptoms · History clues · Red flags</small></div><i>✓</i></div>
                  <div className="public-visual-row"><span>02</span><div><b>Investigations & interpretation</b><small>Expected findings · What they mean</small></div><i>✓</i></div>
                  <div className="public-visual-row"><span>03</span><div><b>Management approach</b><small>Priorities · Rationale · Monitoring</small></div><i>✓</i></div>
                  <div className="public-visual-pills"><span>COMPARISON TABLES</span><span>MEMORY HOOKS</span><span>SBA PRACTICE</span></div>
                </div>
              </div>
              <span className="public-visual-caption">Illustrative preview of the study workflow</span>
            </div>
          </article>

          <article className="public-spotlight-card public-spotlight-video" id="youtube-library">
            <div className="public-spotlight-copy">
              <span className="public-spotlight-kicker">02 / VIDEO LEARNING, BUILT IN</span>
              <h3>Find the lecture. Watch it inside ClerkME. Save it for later.</h3>
              <p>Your study guide can suggest one or two focused videos related to the topic. You can also search YouTube directly from ClerkME without leaving your learning workspace.</p>
              <ul>
                <li>Discover lectures by topic, disease, procedure or clinical unit</li>
                <li>Sort playable results by relevance, views or publication date</li>
                <li>Watch supported videos in ClerkME’s embedded player</li>
                <li>Save useful videos into clinical-unit, revision or custom collections</li>
              </ul>
              <a href="/login" className="public-spotlight-link">Explore the YouTube Library <span>→</span></a>
            </div>
            <div className="public-spotlight-visual public-video-visual" aria-label="Illustrative YouTube library preview">
              <div className="public-video-preview">
                <div className="public-video-preview-top"><span>CLERKME VIDEO LIBRARY</span><b>DISCOVER</b></div>
                <div className="public-video-search-preview"><span>⌕</span> Search a topic or lecture <i>↵</i></div>
                <div className="public-video-recommendation">
                  <div className="public-video-thumb"><span>▶</span><i>LECTURE</i></div>
                  <div><small>LECTURE-LINKED RECOMMENDATION</small><strong>Relevant videos for your topic</strong><span>Choose a result to watch in ClerkME</span></div>
                </div>
                <div className="public-video-actions-preview"><span><b>▶</b> Play in ClerkME</span><span><b>＋</b> Save to collection</span></div>
                <div className="public-video-collections"><span>YOUR COLLECTIONS</span><b>General Medicine</b><b>Exam Revision</b><b>Watch Later</b></div>
              </div>
              <span className="public-visual-caption">Illustrative preview of video discovery and saved collections</span>
            </div>
          </article>
        </div>

        <div className="public-study-tools-heading">
          <div><span className="public-eyebrow">MORE WAYS TO LEARN FROM YOUR MATERIAL</span><h3>Everything stays connected to the source.</h3></div>
          <p>Use these tools together, or open the one that matches what you need to do next.</p>
        </div>
        <div className="public-feature-grid public-study-feature-grid">
          {publicStudyFeatures.map(item => (
            <a className="public-feature-card" href="/login" key={item.number}>
              <span className="public-feature-number">{item.number}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <span className="public-feature-detail">{item.detail}</span>
              <b>Explore in ClerkME <i>→</i></b>
            </a>
          ))}
        </div>
      </section>

      <section className="public-clinical-section" id="clinical-practice">
        <div className="public-section-heading">
          <div>
            <span className="public-eyebrow">FROM KNOWLEDGE TO CLINICAL CONFIDENCE</span>
            <h2>Practise the skills that matter beyond the written paper.</h2>
          </div>
          <p>Build your clinical approach through structured workflows, guided presentations and interactive practice.</p>
        </div>
        <div className="public-clinical-grid">
          {publicClinicalFeatures.map(item => (
            <a className="public-clinical-card" href="/login" key={item.number}>
              <span className="public-clinical-card-top"><span>{item.number}</span><i>↗</i></span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <strong>{item.detail}</strong>
            </a>
          ))}
        </div>
        <div className="public-clinical-note">
          <span className="public-clinical-note-icon">✦</span>
          <div><strong>One connected clinical workspace</strong><p>Move from learning a topic to practising the history, testing your knowledge and reviewing your progress without switching between disconnected tools.</p></div>
          <a href="/login">Enter your workspace <span>→</span></a>
        </div>
      </section>

      <section className="public-how-section" id="how-it-works">
        <div>
          <span className="public-eyebrow">A SIMPLE, CONNECTED WORKFLOW</span>
          <h2>Upload. Understand. Practise. Improve.</h2>
          <p>Bring your own lecture resources, build revision tools around them and practise the knowledge and skills you will need in examinations and clinical placements.</p>
        </div>
        <div className="public-how-steps">
          <div><span>01</span><strong>Upload your source</strong><p>Add a lecture or study document and keep the original alongside your study resources.</p></div>
          <div><span>02</span><strong>Build your study pack</strong><p>Review your study guide, practise lecture-based questions and explore related video recommendations.</p></div>
          <div><span>03</span><strong>Practise and apply</strong><p>Use the question bank, clerking guides, OSCE, Viva, simulation and Flight Academy to keep improving.</p></div>
        </div>
      </section>

      <section className="public-bottom-cta">
        <div>
          <span className="public-eyebrow">YOUR NEXT STUDY SESSION STARTS HERE</span>
          <h2>Prepare with purpose. Practise with confidence.</h2>
          <p>Sign in to open your ClerkME workspace and continue learning.</p>
        </div>
        <a className="public-primary-cta" href="/login">Enter ClerkME <span>→</span></a>
      </section>

      <footer className="public-footer" id="contact">
        <div className="public-footer-brand">
          <ClerkMeBrand caption="CLINICAL CLERKING & EXAM PREP"/>
          <span className="public-footer-copyright">© {new Date().getFullYear()} ClerkME</span>
        </div>
        <p className="public-footer-disclaimer">
          ClerkME is an educational learning companion. AI-generated content may contain errors and should be checked
          against original learning resources, current local guidance and clinical supervision. Do not upload identifiable patient information.
        </p>
        <div className="public-footer-contact">
          <strong>Contact</strong>
          <a href="https://wa.me/2349047324936" target="_blank" rel="noreferrer">WhatsApp · +234 904 732 4936</a>
          <a href="mailto:nwekenoahjerry@gmail.com">nwekenoahjerry@gmail.com</a>
          <small>Designed by Noah Chidindu Nweke</small>
        </div>
      </footer>
    </main>
  );
}

type ClerkMeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function InstallAppPrompt({ promptEvent: sharedPromptEvent, onPromptConsumed }: { promptEvent: ClerkMeInstallPromptEvent | null; onPromptConsumed: () => void }) {
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const deferredPrompt = useRef<ClerkMeInstallPromptEvent | null>(null);
  const installActionRef = useRef<HTMLButtonElement>(null);

  const dismissInvitation = useCallback(() => {
    try {
      // Do not ask again for 30 days after the student chooses "Maybe later".
      window.localStorage.setItem("clerkme-install-invite-dismissed-until-v2", String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    } catch {
      // Dismiss for this page view even when browser storage is unavailable.
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("welcome") === "1") {
      url.searchParams.delete("welcome");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }

    const isStandalone = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as ClerkMeInstallPromptEvent;
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      deferredPrompt.current = null;
      try {
        window.localStorage.setItem("clerkme-install-invite-dismissed-until-v2", String(Date.now() + 365 * 24 * 60 * 60 * 1000));
      } catch {
        // Standalone display mode will identify the installed app on later visits.
      }
    };

    // Register the app shell as soon as the signed-in workspace opens. Do not
    // depend on visiting Account settings before the browser can offer install.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // The in-app instructions remain available if registration is unavailable.
      });
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    let timer: number | undefined;
    let dismissedUntil = 0;
    try {
      dismissedUntil = Number(window.localStorage.getItem("clerkme-install-invite-dismissed-until-v2") || 0);
    } catch {
      // Continue with the invitation when storage is unavailable.
    }
    if (dismissedUntil <= Date.now()) {
      timer = window.setTimeout(() => {
        if (!isStandalone()) setVisible(true);
      }, 1250);
    }

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    installActionRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissInvitation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, dismissInvitation]);

  const showManualInstructions = () => {
    const userAgent = navigator.userAgent;
    const isAppleMobile = /iphone|ipad|ipod/i.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isAppleMobile) setPlatform("ios");
    else if (/android/i.test(userAgent)) setPlatform("android");
    else setPlatform("desktop");
    setShowInstructions(true);
  };

  const install = async () => {
    const promptEvent = deferredPrompt.current || sharedPromptEvent;
    if (!promptEvent) {
      showManualInstructions();
      return;
    }
    deferredPrompt.current = null;
    onPromptConsumed();
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setVisible(false);
      } else {
        showManualInstructions();
      }
    } catch {
      showManualInstructions();
    }
  };

  if (!visible || installed) return null;

  return (
    <div className="install-invite-backdrop" role="presentation">
      <section className="install-invite-dialog" role="dialog" aria-modal="true" aria-labelledby="install-invite-title" aria-describedby="install-invite-description">
        <button className="install-invite-close" type="button" onClick={dismissInvitation} aria-label="Close installation invitation">×</button>
        <div className="install-invite-mark" aria-hidden="true"><span>↥</span><i/></div>
        <span className="install-invite-eyebrow">YOUR CLERKME WORKSPACE</span>
        <h2 id="install-invite-title">Keep ClerkMe one tap away.</h2>
        <p id="install-invite-description">Add ClerkMe to your device for quicker access to your clinical learning workspace.</p>
        {showInstructions && (
          <div className="install-invite-steps" role="status">
            <strong>Install from your browser</strong>
            {platform === "ios" && <p>Open ClerkMe in Safari, tap the Share icon, then choose <b>Add to Home Screen</b>.</p>}
            {platform === "android" && <p>Open your browser menu <b>⋮</b>, then choose <b>Install app</b> or <b>Add to Home screen</b>.</p>}
            {platform === "desktop" && <p>In Chrome or Edge, select the install icon in the address bar, or open the browser menu and choose <b>Install ClerkMe</b>.</p>}
          </div>
        )}
        <div className="install-invite-actions">
          <button ref={installActionRef} className="install-invite-primary" type="button" onClick={showInstructions ? dismissInvitation : install}>
            {showInstructions ? "Got it" : "Install ClerkMe"} <span aria-hidden="true">→</span>
          </button>
          {!showInstructions && <button className="install-invite-later" type="button" onClick={dismissInvitation}>Maybe later</button>}
        </div>
        <span className="install-invite-footnote">You can also install ClerkMe later from Account settings.</span>
      </section>
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState("overview");
  const [moreOpen, setMoreOpen] = useState(false);
  const mobileAccountCloseRef = useRef<HTMLButtonElement>(null);
  const selectSection = (id: string) => { setActive(id); setShowNew(id === "clerking"); setMoreOpen(false); };
  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    mobileAccountCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreOpen]);

  const [osceUnit, setOsceUnit] = useState("general-medicine");
  const [osceIndex, setOsceIndex] = useState(0);
  const [osceReveal, setOsceReveal] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [rawClerkingNotes,setRawClerkingNotes]=useState("");
  const [organisedClerkingProse,setOrganisedClerkingProse]=useState("");
  const [organiseLoading,setOrganiseLoading]=useState(false);
  const [organiseError,setOrganiseError]=useState("");
  const [copyNotice,setCopyNotice]=useState("");
  const [organiseMissing,setOrganiseMissing]=useState<string[]>([]);
  const [organiseUnclear,setOrganiseUnclear]=useState<string[]>([]);
  const [streakData,setStreakData]=useState<{today:string;streak:number;bestStreak:number;activeDays:number;todayActive:boolean;recentDates:string[]}>({today:"",streak:0,bestStreak:0,activeDays:0,todayActive:false,recentDates:[]});
  const [patientName, setPatientName] = useState("");
  const [complaint, setComplaint] = useState("");
  const [saved, setSaved] = useState(false);
  const [authUser, setAuthUser] = useState<{name:string;email:string;profileComplete:number}|null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<ClerkMeInstallPromptEvent | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const signOutTriggerRef = useRef<HTMLButtonElement>(null);
  const confirmSignOutButtonRef = useRef<HTMLButtonElement>(null);
  const [caseList, setCaseList] = useState<Array<{id:string;title:string;case_reference:string;specialty:string;presenting_complaint:string;status:string;updated_at:string}>>([]);
  const [saving, setSaving] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState("general-medicine");
  const clerkingFormRef = useRef<HTMLDivElement>(null);
  const selectedTemplate = templates.find(template => template.id === selectedSpecialty) || templates[0];
  const selectedTemplateFramework = unitClerkingFrameworks[selectedSpecialty];
  const learningWeek = useMemo(() => {
    if (!streakData.today) return [];
    const today = new Date(streakData.today + "T00:00:00Z");
    const monday = new Date(today);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const activeDates = new Set(streakData.recentDates || []);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return {
        key,
        label: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(date),
        active: activeDates.has(key),
        today: key === streakData.today
      };
    });
  }, [streakData.today, streakData.recentDates]);
  const [hpc, setHpc] = useState("");
  const [pastHistory, setPastHistory] = useState("");
  const [medications, setMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const [familyHistory, setFamilyHistory] = useState("");
  const [socialHistory, setSocialHistory] = useState("");
  const [systemsReview, setSystemsReview] = useState("");
  const [vitals, setVitals] = useState("");
  const [examination, setExamination] = useState("");
  const [assessment, setAssessment] = useState("");
  const [differentials, setDifferentials] = useState("");
  const [plan, setPlan] = useState("");
  useEffect(() => {
    // Capture the browser's install event as soon as the workspace loads so
    // both the invitation and Account settings can use the same one-shot prompt.
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as ClerkMeInstallPromptEvent);
    };
    const onInstalled = () => setDeferredInstallPrompt(null);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Manual installation guidance remains available.
      });
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me", {credentials:"same-origin",cache:"no-store"})
      .then(response => response.ok ? response.json() : null)
      .then(data => { if(mounted && data?.user) setAuthUser(data.user); })
      .catch(() => {})
      .finally(() => { if(mounted) setAuthLoading(false); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => { if(!authUser)return; fetch("/api/activity",{method:"POST",credentials:"same-origin"}).then(r=>r.ok?r.json():null).then(d=>{if(d)setStreakData(d);}).catch(()=>{}); },[authUser]);
  useEffect(() => {
    if (!showSignOutConfirm) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSignOutConfirm(false);
        setSignOutError("");
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    confirmSignOutButtonRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
      signOutTriggerRef.current?.focus();
    };
  }, [showSignOutConfirm]);

  const confirmSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Sign out could not be completed. Please try again.");
      window.location.assign("/login");
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Sign out could not be completed. Please try again.");
      setSigningOut(false);
    }
  };

  useEffect(() => {
    const navigate = (event: Event) => {
      const section = (event as CustomEvent<{section?: string}>).detail?.section;
      if (section && navItems.some(([, id]) => id === section)) {
        setActive(section);
        setShowNew(section === "clerking");
        setMoreOpen(false);
      }
    };
    window.addEventListener("clerkme:navigate", navigate);
    return () => window.removeEventListener("clerkme:navigate", navigate);
  }, []);
  const loadCases = async () => { const r = await fetch("/api/cases"); if (r.status === 401) { window.location.href = "/login"; return; } const d = await r.json(); if (r.ok) setCaseList(d.cases || []); else setApiError(d.error || "Could not load cases."); };
  useEffect(() => { if (active === "patients" && authUser) loadCases(); }, [active, authUser]);
  const saveCase = async () => { if (!authUser) { window.location.href = "/login"; return; } setSaving(true); setApiError(""); try { const r = await fetch("/api/cases", { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"same-origin", body:JSON.stringify({caseReference:patientName,title:"Clinical case " + patientName,presentingComplaint:complaint,specialty:selectedSpecialty,history:{historyOfPresentingComplaint:hpc,pastMedicalAndSurgicalHistory:pastHistory,medicationHistory:medications,allergies,familyHistory,socialHistory,reviewOfSystems:systemsReview,rawClerkingNotes,formattedProse:organisedClerkingProse},examination:{vitalSigns:vitals,findings:examination},assessment:{clinicalSummary:assessment,differentialDiagnoses:differentials},plan:{managementPlan:plan}}) }); const d=await r.json(); if (!r.ok) throw new Error(d.error || "Could not save case."); setSaved(true); setActive("patients"); await loadCases(); } catch(e) { setApiError(e instanceof Error ? e.message : "Could not save case."); } finally { setSaving(false); } };

  const resetClerkingDraft = () => {
    setPatientName("");
    setComplaint("");
    setRawClerkingNotes("");
    setOrganisedClerkingProse("");
    setOrganiseError("");
    setOrganiseMissing([]);
    setOrganiseUnclear([]);
    setHpc("");
    setPastHistory("");
    setMedications("");
    setAllergies("");
    setFamilyHistory("");
    setSocialHistory("");
    setSystemsReview("");
    setVitals("");
    setExamination("");
    setAssessment("");
    setDifferentials("");
    setPlan("");
    setApiError("");
    setCopyNotice("");
    setSaved(false);
  };

  const startClerking = (specialty = "general-medicine") => {
    resetClerkingDraft();
    setSelectedSpecialty(specialty);
    setActive("clerking");
    setShowNew(true);
    setMoreOpen(false);
  };

  useEffect(() => {
    if (active !== "clerking" || !showNew) return;
    const frame = window.requestAnimationFrame(() => {
      clerkingFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, showNew, selectedSpecialty]);
  const organiseClerking = async () => {
    setOrganiseLoading(true); setOrganiseError(""); setOrganisedClerkingProse(""); setOrganiseMissing([]); setOrganiseUnclear([]);
    try {
      const r = await fetch("/api/learning/organise", { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"same-origin", body:JSON.stringify({unit:selectedSpecialty,complaint,notes:rawClerkingNotes}) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not organise the notes.");
      fetch("/api/activity",{method:"POST",credentials:"same-origin"}).catch(()=>{});
      setOrganisedClerkingProse(d.prose || "");
      setOrganiseMissing(Array.isArray(d.missingInformation) ? d.missingInformation : []);
      setOrganiseUnclear(Array.isArray(d.unclearOrContradictory) ? d.unclearOrContradictory : []);
    } catch(e) { setOrganiseError(e instanceof Error ? e.message : "Could not organise the notes."); }
    finally { setOrganiseLoading(false); }
  };

  const copyOrganisedProse = async () => {
    if (!organisedClerkingProse) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(organisedClerkingProse);
      setCopyNotice("Organised history copied to your clipboard.");
    } catch {
      window.prompt("Copy the organised clinical history below:", organisedClerkingProse);
      setCopyNotice("Use the copy prompt to copy your organised history.");
    }
  };

  if(authLoading) return <main className="public-loading"><ClerkMeBrand caption="CLINICAL LEARNING WORKSPACE" className="public-brand"/><span>Preparing your workspace…</span></main>;
  if(!authUser) return <PublicLanding/>;
  if(authUser.profileComplete !== 1) return <main className="profile-required-screen"><ClerkMeBrand caption="CLINICAL LEARNING WORKSPACE" className="public-brand"/><section><span className="eyebrow">ONE QUICK SETUP</span><h1>Complete your student profile</h1><p>Add your university, level and location to unlock your private learning workspace.</p><a className="primary-button" href="/profile?setup=1">Complete my profile <span>→</span></a></section></main>;

  return (
    <main className={active === "overview" ? "app-shell home-app-shell" : "app-shell"}>
      <InstallAppPrompt promptEvent={deferredInstallPrompt} onPromptConsumed={() => setDeferredInstallPrompt(null)}/>
      <aside className="sidebar">
        <ClerkMeBrand caption="CLINICAL COMPANION" href="#overview" className="workspace-brand" onClick={() => selectSection("overview")}/>
        <nav className="nav-list" aria-label="Workspace navigation">
          <div className="nav-section-label">CLINICAL WORK</div>
          {navItems.slice(0,5).map(([label, id, icon]) => (
            <button type="button" key={id} className={active === id ? "nav-item active" : "nav-item"} onClick={() => selectSection(id)} aria-label={label} title={label} aria-current={active === id ? "page" : undefined}>
              <span className="nav-icon"><WorkspaceIcon name={icon}/></span><span className="nav-label">{label}</span>
              {id === "clerking" && <span className="nav-plus">+</span>}
            </button>
          ))}
          <div className="nav-section-label nav-section-spaced">STUDY & PRACTISE</div>
          {navItems.slice(5, 11).map(([label, id, icon]) => (
            <button type="button" key={id} className={active === id ? "nav-item active" : "nav-item"} onClick={() => selectSection(id)} aria-label={label} title={label} aria-current={active === id ? "page" : undefined}>
              <span className="nav-icon"><WorkspaceIcon name={icon}/></span><span className="nav-label">{label}</span>
            </button>
          ))}
          <div className="nav-section-label nav-section-spaced">ACCOUNT</div>
          {navItems.slice(11).map(([label, id, icon]) => (
            <button type="button" key={id} className={active === id ? "nav-item active" : "nav-item"} onClick={() => selectSection(id)} aria-label={label} title={label} aria-current={active === id ? "page" : undefined}>
              <span className="nav-icon"><WorkspaceIcon name={icon}/></span><span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card"><div className="upgrade-icon">◉</div><strong>Learn with confidence</strong><p>Build your clinical skills, one patient at a time.</p><button onClick={() => selectSection("guides")}>Explore guides <span>↗</span></button></div>
          <button type="button" className="profile profile-link sidebar-account-button" onClick={() => selectSection("you")}>
            <div className="avatar">{authUser?.name?.[0] || "C"}</div>
            <div><strong>{authUser?.name || "Medical student"}</strong><small>Account settings</small></div>
          </button>
        </div>
      </aside>

      <nav className="mobile-dock" aria-label="Main navigation">
        <button type="button" className={active==="overview"?"mobile-dock-item active":"mobile-dock-item"} onClick={()=>selectSection("overview")} aria-current={active==="overview"?"page":undefined}>
          <span><WorkspaceIcon name="home"/></span><small>Home</small>
        </button>
        <button type="button" className={active==="clerking"?"mobile-dock-item active":"mobile-dock-item"} onClick={()=>selectSection("clerking")} aria-current={active==="clerking"?"page":undefined}>
          <span><WorkspaceIcon name="file-plus"/></span><small>Clerk</small>
        </button>
        <button type="button" className={["study","materials","videos","osce","qbank","game"].includes(active)?"mobile-dock-item active":"mobile-dock-item"} onClick={()=>selectSection("study")} aria-current={["study","materials","videos","osce","qbank","game"].includes(active)?"page":undefined}>
          <span><WorkspaceIcon name="book-open"/></span><small>Study</small>
        </button>
        <button type="button" className={active==="simulation"?"mobile-dock-item active":"mobile-dock-item"} onClick={()=>selectSection("simulation")} aria-current={active==="simulation"?"page":undefined}>
          <span><WorkspaceIcon name="stethoscope"/></span><small>Sim</small>
        </button>
        <button type="button" className={moreOpen||active==="you"?"mobile-dock-item active":"mobile-dock-item"} onClick={()=>setMoreOpen(true)} aria-expanded={moreOpen} aria-controls="mobile-account-sheet">
          <span className="mobile-dock-avatar">{authUser?.name?.[0] || "C"}</span><small>You</small>
        </button>
      </nav>
      {moreOpen && <div className="mobile-more-scrim" onClick={()=>setMoreOpen(false)}>
        <section id="mobile-account-sheet" className="mobile-more-panel mobile-account-sheet" role="dialog" aria-modal="true" aria-label="Your ClerkME account and tools" onClick={event=>event.stopPropagation()}>
          <div className="mobile-account-sheet-topline"><span>YOUR CLERKME</span><button ref={mobileAccountCloseRef} type="button" onClick={()=>setMoreOpen(false)} aria-label="Close account menu">×</button></div>
          <button type="button" className="mobile-account-profile" onClick={()=>selectSection("you")}>
            <span className="mobile-account-avatar">{authUser?.name?.[0] || "C"}</span>
            <span className="mobile-account-profile-copy"><strong>{authUser?.name || "Medical student"}</strong><small>{authUser?.email || "Your student account"}</small><em>Profile & settings <b>→</b></em></span>
            <span className="mobile-account-profile-arrow">›</span>
          </button>
          <div className="mobile-account-section-heading"><strong>Clinical workspace</strong><span>Patient care and clinical skills</span></div>
          <div className="mobile-account-tool-grid">
            <button type="button" className="mobile-account-tool" onClick={()=>selectSection("guides")}><span className="mobile-account-tool-icon clinical"><WorkspaceIcon name="book-check"/></span><strong>Clinical guides</strong></button>
            <button type="button" className="mobile-account-tool" onClick={()=>selectSection("patients")}><span className="mobile-account-tool-icon cases"><WorkspaceIcon name="users"/></span><strong>My cases</strong></button>
          </div>
          <div className="mobile-account-section-heading"><strong>Study & practise</strong><span>Resources built for your learning</span></div>
          <div className="mobile-account-tool-grid">
            <button type="button" className="mobile-account-tool" onClick={()=>selectSection("study")}><span className="mobile-account-tool-icon questions"><WorkspaceIcon name="book-open"/></span><strong>Study home</strong></button>
            <button type="button" className="mobile-account-tool" onClick={()=>selectSection("materials")}><span className="mobile-account-tool-icon clinical"><WorkspaceIcon name="folder-open"/></span><strong>My materials</strong></button>
            <button type="button" className="mobile-account-tool" onClick={()=>selectSection("videos")}><span className="mobile-account-tool-icon video"><WorkspaceIcon name="play-square"/></span><strong>YouTube library</strong></button>
            <button type="button" className="mobile-account-tool" onClick={()=>selectSection("osce")}><span className="mobile-account-tool-icon osce"><WorkspaceIcon name="clipboard-list"/></span><strong>OSCE & Viva</strong></button>
            <button type="button" className="mobile-account-tool" onClick={()=>selectSection("qbank")}><span className="mobile-account-tool-icon questions"><WorkspaceIcon name="list-checks"/></span><strong>Question bank</strong></button>
            <button type="button" className="mobile-account-tool" onClick={()=>selectSection("game")}><span className="mobile-account-tool-icon flight"><WorkspaceIcon name="plane"/></span><strong>Flight Academy</strong></button>
          </div>
          <div className="mobile-account-settings-row">
            <span><strong>Install ClerkME</strong><small>Add ClerkME to your device for easier access.</small></span>
            <InstallAppButton promptEvent={deferredInstallPrompt} onPromptConsumed={() => setDeferredInstallPrompt(null)}/>
          </div>
        </section>
      </div>}

      <section className={active === "overview" ? "main-area home-dashboard-active" : "main-area"}>
        <header className="topbar"><ClerkMeBrand href="#overview" className="mobile-brand" onClick={() => selectSection("overview")}/><div className="breadcrumb">Workspace <span>/</span> <strong>{navItems.find(x => x[1] === active)?.[0] || (active === "study" ? "Study tools" : "Home")}</strong></div><div className="top-actions"><button type="button" className="profile-top-link" onClick={() => setActive("you")}>Account</button><span className="status-dot"></span><span className="saved-label">{authUser ? authUser.name : "Your workspace"}</span><button type="button" className="avatar small-avatar account-avatar-button" onClick={() => { if (window.matchMedia("(max-width:760px)").matches) setMoreOpen(true); else selectSection("you"); }} aria-label="Open account settings">{authUser?.name?.[0] || "C"}</button></div></header>
        <div className="content">
{active === "overview" && <>
<section className="home-compact-header"><div><div className="eyebrow">YOUR CLINICAL WORKSPACE</div><h1>Good to see you, {authUser?.name?.trim().split(/\s+/)[0] || "there"}.</h1><p>Make today a useful study day.</p></div><span className="home-greeting-mark" aria-hidden="true">✦</span></section>
<section className="home-stats-strip" aria-label="Your learning statistics"><div className="home-streak-stat"><span className="home-streak-orbit" aria-hidden="true">✦</span><strong>{streakData.streak}</strong><span>Day streak</span></div><div><strong>{streakData.bestStreak}</strong><span>Best streak</span></div><div><strong>{streakData.activeDays}</strong><span>Active days</span></div><span className={streakData.todayActive?"home-checkin is-active":"home-checkin"}>{streakData.todayActive?"✓ Studied today":"Your next session starts here"}</span></section>
<section className="home-motivation" aria-label="Daily motivation"><span className="home-motivation-icon" aria-hidden="true">✦</span><div><span className="eyebrow">A NOTE FOR YOUR JOURNEY</span><p>{["Small, consistent study sessions build the clinical judgement that lasts.","You do not need to master everything today. Understand one concept well, then build on it.","Every question you attempt is an opportunity to sharpen your clinical reasoning.","Progress is not measured by hours alone, but by what you understand and can apply.","Stay curious, practise deliberately, and let consistency do the heavy lifting."][(new Date().getDate()+new Date().getMonth())%5]}</p></div></section>
<section className="home-quick-start" aria-label="Quick study actions"><div className="home-section-heading"><div><span className="eyebrow">YOUR NEXT STEP</span><h2>What would you like to work on?</h2></div></div><div className="home-action-grid">
<button type="button" className="home-action-card" onClick={()=>selectSection("materials")}><span className="home-action-icon"><WorkspaceIcon name="folder-open"/></span><span><strong>My materials</strong><small>Open lectures and study guides</small></span><b>→</b></button>
<button type="button" className="home-action-card" onClick={()=>selectSection("qbank")}><span className="home-action-icon"><WorkspaceIcon name="list-checks"/></span><span><strong>Question bank</strong><small>Test your knowledge</small></span><b>→</b></button>
<button type="button" className="home-action-card" onClick={()=>selectSection("videos")}><span className="home-action-icon"><WorkspaceIcon name="play-square"/></span><span><strong>Video library</strong><small>Watch clinical lectures</small></span><b>→</b></button>
<button type="button" className="home-action-card" onClick={()=>startClerking()}><span className="home-action-icon"><WorkspaceIcon name="stethoscope"/></span><span><strong>Clinical practice</strong><small>Start a patient clerking</small></span><b>→</b></button>
</div></section>
<footer className="footer-note home-compact-footer">ClerkME supports learning and practice; it does not replace clinical supervision, current local protocols or professional judgement. Do not upload identifiable patient information.</footer>
</>}{active === "study" && <>
            <div className="page-intro study-hub-intro">
              <div className="eyebrow">YOUR STUDY WORKSPACE</div>
              <h1>Study</h1>
              <p>Your lectures, questions and teaching videos — together in one place.</p>
            </div>

            <div className="study-hub-section-heading">
              <div><h2>Where would you like to start?</h2><p>Choose your materials or jump straight into practice.</p></div>
            </div>
            <div className="study-hub-primary-grid">
              <button type="button" className="study-hub-card" onClick={()=>selectSection("materials")}>
                <span className="study-hub-card-icon high-yield">▤</span>
                <span className="study-hub-card-copy"><strong>My Materials</strong><small>Find your uploaded lectures and open the study guide, original file, practice questions or ask ClerkME about a topic.</small></span>
                <span className="study-hub-card-link">Open my library <b>→</b></span>
              </button>
              <button type="button" className="study-hub-card" onClick={()=>selectSection("qbank")}>
                <span className="study-hub-card-icon quiz">☑</span>
                <span className="study-hub-card-copy"><strong>Question Bank</strong><small>Practise single-best-answer questions from your uploaded lectures and the clinical question bank, with explanations.</small></span>
                <span className="study-hub-card-link">Practise questions <b>→</b></span>
              </button>
              <button type="button" className="study-hub-card" onClick={()=>selectSection("videos")}>
                <span className="study-hub-card-icon videos">▶</span>
                <span className="study-hub-card-copy"><strong>YouTube library</strong><small>Find lecture recommendations by topic, disease or clinical unit. Watch supported videos inside ClerkME and save them to collections.</small></span>
                <span className="study-hub-card-link">Explore video library <b>→</b></span>
              </button>
            </div>

            <div className="study-hub-section-heading study-hub-more-heading">
              <div><h2>More ways to practise</h2><p>Move from revision to exam-style application.</p></div>
            </div>
            <div className="study-hub-secondary-grid">
              <button type="button" className="study-hub-format-card" onClick={()=>selectSection("osce")}>
                <span className="study-hub-format-icon">◎</span><span><strong>OSCE & Viva practice</strong><small>Work through clinical prompts and reveal examiner-style teaching points.</small></span><b>→</b>
              </button>
              <button type="button" className="study-hub-format-card" onClick={()=>selectSection("game")}>
                <span className="study-hub-format-icon flight">✈</span><span><strong>Flight Academy</strong><small>Test your recall through adaptive, unit- and lecture-based questions.</small></span><b>→</b>
              </button>
            </div>
          </>}
          
          {active === "you" && <>
            <div className="page-intro">
              <div className="eyebrow">ACCOUNT & PREFERENCES</div>
              <h1>Account & settings</h1>
              <p>Manage your academic profile, access ClerkME on your devices and control your current sign-in session.</p>
            </div>

            <section className="panel you-account-panel" aria-label="Account overview">
              <div className="you-account-avatar">{authUser?.name?.trim()?.[0]?.toUpperCase() || "C"}</div>
              <div className="you-account-details">
                <span className="eyebrow">ACCOUNT OVERVIEW</span>
                <strong>{authUser?.name || "Medical student"}</strong>
                <small>{authUser?.email || "Your ClerkME account"}</small>
                <span className={authUser?.profileComplete === 1 ? "you-account-status is-complete" : "you-account-status is-incomplete"}>{authUser?.profileComplete === 1 ? "✓ Academic profile complete" : "Finish your academic profile"}</span>
              </div>
              <a className="you-profile-link" href="/profile">{authUser?.profileComplete === 1 ? "Manage profile" : "Complete profile"} <span aria-hidden="true">→</span></a>
            </section>
            <div className="account-settings-section-heading"><div><span className="eyebrow">PREFERENCES & ACCESS</span><h2>Manage your settings</h2></div><p>Only the controls currently supported by ClerkME are shown here.</p></div>

            <section className="account-settings-grid" aria-label="Account settings">
              <article className="panel account-settings-group">
                <div className="account-settings-group-heading"><span className="account-settings-icon">◎</span><div><h3>Personal & academic profile</h3><p>Keep your student information accurate and up to date.</p></div></div>
                <a className="you-setting-action" href="/profile">
                  <span className="account-settings-row-icon" aria-hidden="true">✎</span>
                  <span><strong>Student profile</strong><small>Name, university, level, location and career interests.</small></span>
                  <span className="you-action-label">Edit profile <b aria-hidden="true">→</b></span>
                </a>
              </article>
              <article className="panel account-settings-group">
                <div className="account-settings-group-heading"><span className="account-settings-icon">▣</span><div><h3>App & device</h3><p>Make ClerkME easier to access on your devices.</p></div></div>
                <div className="you-setting-action">
                  <span className="account-settings-row-icon" aria-hidden="true">▣</span>
                  <span><strong>Install ClerkME</strong><small>Add ClerkME to your home screen or desktop where supported.</small></span>
                  <InstallAppButton promptEvent={deferredInstallPrompt} onPromptConsumed={() => setDeferredInstallPrompt(null)}/>
                </div>
              </article>
              <article className="panel account-settings-group account-settings-security">
                <div className="account-settings-group-heading"><span className="account-settings-icon">⌑</span><div><h3>Session & security</h3><p>Manage your current sign-in session.</p></div></div>
                <button ref={signOutTriggerRef} type="button" className="you-setting-action" disabled={signingOut} onClick={() => { setSignOutError(""); setShowSignOutConfirm(true); }}>
                  <span className="account-settings-row-icon account-settings-danger-icon" aria-hidden="true">↗</span>
                  <span><strong>Sign out</strong><small>Securely end your current ClerkME session on this device.</small></span>
                  <span className="you-action-label">Sign out</span>
                </button>
              </article>
            </section>
          </>}
          
{active === "clerking" && <><div className="page-intro"><div className="eyebrow">PATIENT ASSESSMENT</div><h1>Clinical clerking</h1><p>Choose a structured template and organise your patient encounter.</p></div><div className="template-grid">{templates.map(t => <article className={showNew && selectedSpecialty === t.id ? "template-card template-card-selected" : "template-card"} key={t.id}><span className="template-icon large">{t.icon}</span><span className="template-tag">{t.tag}</span><h3>{t.title}</h3><p>{t.detail}</p><button type="button" className="template-use-button" onClick={() => startClerking(t.id)}>{showNew && selectedSpecialty === t.id ? "Selected template ✓" : "Use template →"}</button></article>)}</div>{showNew && <div className="form-panel" ref={clerkingFormRef} tabIndex={-1}><div className="panel-heading"><div><span className="eyebrow">SELECTED TEMPLATE · {selectedTemplate.tag}</span><h3>{selectedTemplate.title}</h3><p>Use a non-identifying study reference. Do not enter patient names, hospital numbers or contact details.</p></div><button type="button" className="close-button" aria-label="Close clerking form" onClick={() => setShowNew(false)}>×</button></div>
            {selectedTemplateFramework && <div className="selected-template-context"><strong>{selectedTemplateFramework.title} focus</strong><p>{selectedTemplateFramework.overview}</p><div><span>Specialty-specific sections</span><ul>{selectedTemplateFramework.unitSections.map(section => <li key={section.title}>{section.title}</li>)}</ul></div></div>}
            <div className="clerking-note-panel"><div className="clerking-note-heading"><div><span className="eyebrow">CLERKING NOTE ORGANISER</span><h3>Organise rough notes into a clear clinical history</h3><p>Upload a document or paste your notes. ClerkMe will arrange the information you provide and identify details that still need to be checked.</p></div><span className="upload-icon">✎</span></div>
              <label className="slide-file-picker"><span>⇧</span><span><strong>Upload existing clerking notes</strong><small>{STUDY_FILE_TYPES} · remove names and hospital identifiers first</small></span><input type="file" accept={STUDY_FILE_ACCEPT} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setOrganiseError("");try{const extracted=await extractStudyFile(file);setRawClerkingNotes(extracted.text);}catch(err){setOrganiseError(err instanceof Error?err.message:"Could not read that file.");}}}/></label>
              <label>Paste or edit your raw clerking notes<textarea rows={7} value={rawClerkingNotes} onChange={e=>setRawClerkingNotes(e.target.value)} placeholder="Paste your rough notes here: presenting complaint, chronology, associated symptoms, relevant negatives, past history, medications, examination and assessment…"/></label>
              <button className="primary-button" onClick={organiseClerking} disabled={organiseLoading||rawClerkingNotes.trim().length<30}>{organiseLoading?"Organising your clerking…":"Organise into clinical prose"} <span>→</span></button>
              {organiseError&&<p className="auth-error">{organiseError}</p>}
              {organisedClerkingProse&&<div className="organised-prose"><div className="panel-heading"><h3>Organised clinical history</h3><button type="button" className="text-link" onClick={copyOrganisedProse}>Copy prose</button></div><pre>{organisedClerkingProse}</pre>{copyNotice&&<p className="copy-status" role="status">{copyNotice}</p>}{organiseMissing.length>0&&<div className="prose-followups"><strong>Information still to obtain</strong><ul>{organiseMissing.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}{organiseUnclear.length>0&&<div className="prose-followups"><strong>Unclear or conflicting details to verify</strong><ul>{organiseUnclear.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}<small>Check every sentence against the original notes before using or saving this write-up. ClerkMe does not add missing clinical facts.</small></div>}
            </div>
            <label>Patient study identifier<input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. Case 001"/></label><label>Presenting complaint<input value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="e.g. Fever for 5 days"/></label>
            <div className="clerking-section-title">01 · HISTORY OF PRESENTING COMPLAINT</div>
            <label>History of presenting complaint<textarea value={hpc} onChange={e=>setHpc(e.target.value)} placeholder="Onset, duration, progression, character, associated symptoms, aggravating and relieving factors, relevant negatives…" rows={4}/></label>
            <div className="clerking-fields"><label>Past medical and surgical history<textarea value={pastHistory} onChange={e=>setPastHistory(e.target.value)} rows={3}/></label><label>Medication history<textarea value={medications} onChange={e=>setMedications(e.target.value)} rows={3}/></label><label>Allergies<textarea value={allergies} onChange={e=>setAllergies(e.target.value)} rows={2}/></label><label>Family history<textarea value={familyHistory} onChange={e=>setFamilyHistory(e.target.value)} rows={2}/></label><label>Social history<textarea value={socialHistory} onChange={e=>setSocialHistory(e.target.value)} rows={2}/></label><label>Review of systems<textarea value={systemsReview} onChange={e=>setSystemsReview(e.target.value)} rows={3}/></label></div>
            <div className="clerking-section-title">02 · PHYSICAL EXAMINATION</div>
            <label>Vital signs<textarea value={vitals} onChange={e=>setVitals(e.target.value)} placeholder="BP, pulse, respiratory rate, temperature, SpO₂, weight…" rows={2}/></label>
            <label>Examination findings<textarea value={examination} onChange={e=>setExamination(e.target.value)} placeholder="General examination and relevant systemic examination findings…" rows={4}/></label>
            <div className="clerking-section-title">03 · CLINICAL ASSESSMENT</div>
            <label>Clinical summary<textarea value={assessment} onChange={e=>setAssessment(e.target.value)} rows={3}/></label>
            <label>Differential diagnoses<textarea value={differentials} onChange={e=>setDifferentials(e.target.value)} rows={3}/></label>
            <div className="clerking-section-title">04 · PLAN</div>
            <label>Investigation and management plan<textarea value={plan} onChange={e=>setPlan(e.target.value)} rows={4}/></label>
            <button className="primary-button" onClick={saveCase} disabled={!patientName.trim() || !complaint.trim() || saving}>{saving ? "Saving…" : "Save case securely"} <span>→</span></button>{apiError && <p className="auth-error">{apiError}</p>}{saved && <p className="success-note">Your case has been saved to your account.</p>}{!authUser && <p className="auth-message">Sign in is required to save cases. <a href="/login">Sign in with Google</a>.</p>}</div>}</>}

          {active === "patients" && <><div className="page-intro"><div className="eyebrow">PRIVATE CASE LIBRARY</div><h1>My cases</h1><p>Cases are visible only to the account that created them.</p></div><button className="primary-button" onClick={loadCases}>Refresh cases</button>{!authUser ? <div className="empty-state"><p>Sign in to view your saved cases.</p><a className="sign-in-link" href="/login">Sign in with Google</a></div> : <div className="panel case-library">{caseList.length ? caseList.map(c=><div className="template-row" key={c.id}><span className="template-icon">▤</span><span className="template-info"><strong>{c.title} · {c.case_reference}</strong><small>{c.specialty} · {c.presenting_complaint}</small></span><span className="template-tag">{c.status}</span></div>) : <div className="empty-state"><p>No saved cases yet. Start your first clerking.</p><button className="primary-button" onClick={() => startClerking()}>Start a clerking →</button></div>}</div>}</> }
          {active === "guides" && <ClinicalGuides/>}
          {active === "materials" && <MaterialsPanel/>}
          {active === "videos" && <VideoLibraryPanel/>}
          {active === "osce" && <><div className="page-intro"><div className="eyebrow">PRACTICAL EXAM PREPARATION</div><h1>OSCE & Viva practice</h1><p>Use unit-specific clinical prompts to practise your reasoning and oral presentation.</p></div><div className="learning-toolbar"><label>Choose your unit<select value={osceUnit} onChange={e=>{setOsceUnit(e.target.value);setOsceIndex(0);setOsceReveal(false);}}>{clinicalUnits.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><p>Read the stem, formulate your answer aloud, then reveal the teaching points.</p></div>{(()=>{const qs=questionBank.filter(q=>q.unit===osceUnit);const q=qs[osceIndex%qs.length];return q?<div className="osce-card"><div className="question-topline"><span>VIVA STATION {String(osceIndex+1).padStart(2,"0")}</span><span>{q.topic} · {q.level}</span></div><h2>{q.q}</h2><p className="osce-instruction">Before revealing the answer, state your most likely answer and explain your clinical reasoning as if presenting to an examiner.</p><button className="primary-button" onClick={()=>setOsceReveal(v=>!v)}>{osceReveal?"Hide teaching points":"Reveal teaching points"} <span>→</span></button>{osceReveal&&<div className="guide-section"><h3>Examiner's teaching points</h3><p><strong>Best answer:</strong> {q.o[q.a]}</p><p>{q.e}</p></div>}<button className="secondary-button" onClick={()=>{setOsceIndex(i=>i+1);setOsceReveal(false);}}>Next viva prompt →</button></div>:<p>No prompts are available for this unit yet.</p>})()}</>}
          {active === "game" && <><div className="page-intro"><div className="eyebrow">SUBJECT- AND MATERIAL-ADAPTIVE LEARNING</div><h1>Flight simulator</h1><p>Practise with questions from your selected subject and uploaded study materials.</p></div><AdaptiveFlightGame onOpenMaterials={()=>setActive("materials")}/></>}
          {active === "simulation" && <ClinicalSimulation/>}
          {active === "qbank" && <LearningQuestionBank/>}
          <FocusMusicPlayer inVideoLibrary={active === "videos"}/>
        </div>
      </section>
      {showSignOutConfirm && (
        <div
          className="signout-confirm-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !signingOut) {
              setShowSignOutConfirm(false);
              setSignOutError("");
            }
          }}
        >
          <section
            className="signout-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="signout-confirm-title"
            aria-describedby="signout-confirm-description"
          >
            <div className="signout-confirm-icon" aria-hidden="true">⏻</div>
            <span className="eyebrow">ACCOUNT</span>
            <h2 id="signout-confirm-title">Do you want to sign out?</h2>
            <p id="signout-confirm-description">You will need to sign in again to access your ClerkME workspace and saved learning materials.</p>
            {signOutError && <p className="signout-confirm-error" role="alert">{signOutError}</p>}
            <div className="signout-confirm-actions">
              <button
                type="button"
                className="signout-cancel-button"
                disabled={signingOut}
                onClick={() => { setShowSignOutConfirm(false); setSignOutError(""); }}
              >
                Cancel
              </button>
              <button
                ref={confirmSignOutButtonRef}
                type="button"
                className="signout-accept-button"
                disabled={signingOut}
                onClick={confirmSignOut}
              >
                {signingOut ? "Signing out…" : "Yes, sign out"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
