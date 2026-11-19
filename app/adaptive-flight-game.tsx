"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { clinicalUnits, questionBank } from "../lib/learning-content";

type GeneratedQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  topic: string;
  difficulty: string;
};
type FlightQuestion = GeneratedQuestion & { id: string; source: string };
type StudyMaterial = {
  id: string;
  title: string;
  unit: string;
  questions?: GeneratedQuestion[];
};

const QUESTION_SECONDS = 20;
const MAX_ROUND_LENGTH = 10;
const ANSWER_REVIEW_MS = 6500;

const fallbackQuestions = questionBank as unknown as Array<{
  id: string; unit: string; topic: string; level: string; q: string; o: string[]; a: number; e: string;
}>;

function isGeneratedQuestion(value: unknown): value is GeneratedQuestion {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GeneratedQuestion>;
  return typeof item.question === "string" && item.question.trim().length > 0
    && Array.isArray(item.options) && item.options.length >= 2 && item.options.length <= 8
    && item.options.every((option) => typeof option === "string" && option.trim().length > 0)
    && Number.isInteger(item.answerIndex) && item.answerIndex! >= 0 && item.answerIndex! < item.options.length
    && typeof item.explanation === "string" && item.explanation.trim().length > 0
    && typeof item.topic === "string" && typeof item.difficulty === "string";
}

function shuffleOptions(question: FlightQuestion): FlightQuestion {
  const options = question.options.map((text, originalIndex) => ({ text, originalIndex }));
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    ...question,
    options: options.map((option) => option.text),
    answerIndex: options.findIndex((option) => option.originalIndex === question.answerIndex)
  };
}

function shuffleQuestions(items: FlightQuestion[]): FlightQuestion[] {
  const deck = [...items];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function readStoredNumber(key: string): number {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export default function AdaptiveFlightGame({ onOpenMaterials }: { onOpenMaterials: () => void }) {
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [unit, setUnit] = useState("general-medicine");
  const [materialId, setMaterialId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [altitude, setAltitude] = useState(1000);
  const [bestAltitude, setBestAltitude] = useState(1000);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [points, setPoints] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [completedFlights, setCompletedFlights] = useState(0);
  const [questionDeck, setQuestionDeck] = useState<FlightQuestion[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("");
  const [questionOverflow, setQuestionOverflow] = useState(0);
  const lastFirstQuestionRef = useRef<string | null>(null);
  const answerLockedRef = useRef(false);
  const questionLineRef = useRef<HTMLDivElement | null>(null);

  const reload = async () => {
    const response = await fetch("/api/learning/materials", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json().catch(() => ({ error: "Could not read your study library." }));
    if (!response.ok) throw new Error(data.error || "Sign in to use your private study materials.");
    setMaterials(Array.isArray(data.materials) ? data.materials : []);
  };

  useEffect(() => {
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your study library."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setBestAltitude(Math.max(1000, readStoredNumber("clerkme-flight-best-altitude")));
    setBestScore(readStoredNumber("clerkme-flight-best-score"));
    setCompletedFlights(readStoredNumber("clerkme-flight-completed"));
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("clerkme-flight-best-altitude", String(bestAltitude));
    } catch {}
  }, [bestAltitude]);

  useEffect(() => {
    if (!gameOver) return;
    try {
      const nextBest = Math.max(readStoredNumber("clerkme-flight-best-score"), points);
      const nextCompleted = readStoredNumber("clerkme-flight-completed") + 1;
      window.localStorage.setItem("clerkme-flight-best-score", String(nextBest));
      window.localStorage.setItem("clerkme-flight-completed", String(nextCompleted));
      setBestScore(nextBest);
      setCompletedFlights(nextCompleted);
    } catch {}
  }, [gameOver, points]);

  const unitMaterials = useMemo(() => materials.filter((item) => item.unit === unit), [materials, unit]);
  const chosenMaterial = unitMaterials.find((item) => item.id === materialId);

  const uploadedQuestions = useMemo(() => {
    const rows = materialId === "all" ? unitMaterials : chosenMaterial ? [chosenMaterial] : [];
    return rows.flatMap((item) => (item.questions || [])
      .filter(isGeneratedQuestion)
      .map((question, i) => ({ ...question, id: item.id + "-" + i, source: item.title })));
  }, [unitMaterials, chosenMaterial, materialId]);

  const builtInQuestions = useMemo(() => fallbackQuestions.filter((item) => item.unit === unit), [unit]);

  const activeQuestions: FlightQuestion[] = materialId !== "all" && chosenMaterial
    ? uploadedQuestions
    : uploadedQuestions.length
      ? uploadedQuestions
      : builtInQuestions.map((item) => ({
          question: item.q,
          options: item.o,
          answerIndex: item.a,
          explanation: item.e,
          topic: item.topic,
          difficulty: item.level,
          source: "ClerkMe core bank",
          id: item.id
        }));

  const questionPool = questionDeck.length ? questionDeck : activeQuestions;
  const roundLength = Math.min(MAX_ROUND_LENGTH, questionPool.length);
  const question = questionPool[index] || null;
  const ungeneratedMaterials = unitMaterials.filter((item) => !(item.questions || []).some(isGeneratedQuestion));
  const selectedMaterialNeedsQuestions = !!chosenMaterial && !uploadedQuestions.length;

  const clearRound = () => {
    answerLockedRef.current = false;
    setQuestionDeck([]);
    setStarted(false);
    setIndex(0);
    setSelected(null);
    setTimeLeft(QUESTION_SECONDS);
    setAltitude(1000);
    setCorrect(0);
    setWrong(0);
    setStreak(0);
    setBestStreak(0);
    setPoints(0);
    setGameOver(false);
    setGenerationMessage("");
  };

  const reset = () => {
    const deck = shuffleQuestions(activeQuestions.map(shuffleOptions));
    if (deck.length > 1 && deck[0]?.id === lastFirstQuestionRef.current) {
      [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    lastFirstQuestionRef.current = deck[0]?.id ?? null;
    answerLockedRef.current = false;
    setQuestionDeck(deck);
    setStarted(true);
    setIndex(0);
    setSelected(null);
    setTimeLeft(QUESTION_SECONDS);
    setAltitude(1000);
    setCorrect(0);
    setWrong(0);
    setStreak(0);
    setBestStreak(0);
    setPoints(0);
    setGameOver(false);
    setError("");
  };

  const changeUnit = (value: string) => {
    setUnit(value);
    setMaterialId("all");
    clearRound();
    setError("");
  };

  const changeMaterial = (value: string) => {
    setMaterialId(value);
    clearRound();
    setError("");
  };

  const generateForSelected = async () => {
    if (!chosenMaterial) return;
    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/learning/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ materialId: chosenMaterial.id, count: 25, level: "Mixed" })
      });
      const data = await response.json().catch(() => ({ error: "The question service returned an unreadable response." }));
      if (!response.ok) throw new Error(data.error || "Could not create questions from this material.");
      await reload();
      clearRound();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Question generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const generateForUnitMaterials = async () => {
    const pending = ungeneratedMaterials.slice(0, 5);
    if (!pending.length) return;
    setGenerating(true);
    setError("");
    setGenerationMessage("Preparing questions from " + pending.length + " of " + ungeneratedMaterials.length + " study materials...");
    let created = 0;
    const failed: string[] = [];
    try {
      for (const material of pending) {
        try {
          const response = await fetch("/api/learning/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ materialId: material.id, count: 20, level: "Mixed" })
          });
          const data = await response.json().catch(() => ({ error: "The question service returned an unreadable response." }));
          if (!response.ok) throw new Error(data.error || "Question generation failed.");
          created += Number(data.generated) || 0;
        } catch (e) {
          failed.push(material.title + ": " + (e instanceof Error ? e.message : "Generation failed."));
        }
      }
      await reload();
      clearRound();
      setGenerationMessage(created
        ? "Created " + created + " questions from " + (pending.length - failed.length) + " study material" + (pending.length - failed.length === 1 ? "" : "s") + "."
        : "No new questions were created.");
      if (failed.length) setError(failed.join(" · "));
      else if (ungeneratedMaterials.length > pending.length) {
        setGenerationMessage((current) => current + " " + (ungeneratedMaterials.length - pending.length) + " more materials remain; select this action again to prepare the next batch.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate questions from your materials.");
    } finally {
      setGenerating(false);
    }
  };

  const answerQuestion = useCallback((option: number) => {
    if (answerLockedRef.current || !question || gameOver) return;
    answerLockedRef.current = true;
    setSelected(option);
    void fetch("/api/activity", { method: "POST", credentials: "same-origin" }).catch(() => {});

    if (option === question.answerIndex) {
      const nextAltitude = altitude + 250;
      const nextStreak = streak + 1;
      setAltitude(nextAltitude);
      setBestAltitude((value) => Math.max(value, nextAltitude));
      setCorrect((value) => value + 1);
      setStreak(nextStreak);
      setBestStreak((value) => Math.max(value, nextStreak));
      setPoints((value) => value + 100 + Math.min(streak, 4) * 25);
    } else {
      const nextWrong = wrong + 1;
      setWrong(nextWrong);
      setStreak(0);
      setPoints((value) => Math.max(0, value - 25));
      setAltitude(nextWrong >= 3 ? 0 : Math.max(0, altitude - 300));
      if (nextWrong >= 3) setGameOver(true);
    }
  }, [altitude, gameOver, question, streak, wrong]);

  const advanceQuestion = useCallback(() => {
    if (selected === null || gameOver) return;
    if (index + 1 >= roundLength) {
      setGameOver(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
    setTimeLeft(QUESTION_SECONDS);
    answerLockedRef.current = false;
  }, [gameOver, index, roundLength, selected]);

  useEffect(() => {
    if (selected === null || gameOver) return;
    const timer = window.setTimeout(advanceQuestion, ANSWER_REVIEW_MS);
    return () => window.clearTimeout(timer);
  }, [selected, gameOver, advanceQuestion]);

  useEffect(() => {
    if (!started || gameOver || selected !== null || !question) return;
    if (timeLeft <= 0) {
      answerQuestion(-1);
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [started, gameOver, selected, question?.id, timeLeft, answerQuestion]);

  useEffect(() => {
    const element = questionLineRef.current;
    if (!element) {
      setQuestionOverflow(0);
      return;
    }
    const measure = () => setQuestionOverflow(Math.max(0, Math.ceil(element.scrollWidth - element.clientWidth)));
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    if (observer && element.firstElementChild) observer.observe(element.firstElementChild);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [question, started, gameOver]);

  const questionLineStyle = { "--flight-question-overflow": questionOverflow + "px" } as CSSProperties;
  const completedMissions = Math.min(roundLength, index + (selected !== null ? 1 : 0));
  const accuracy = correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0;

  return <section className={"flight-quiz" + (started && !gameOver ? " flight-playing" : "") + (gameOver ? " flight-game-over" : "")}>
    <div className="flight-quiz-heading">
      <div>
        <span className="eyebrow">UNIT-BASED CLINICAL GAME</span>
        <h2>Skyward <span>Flight Academy</span></h2>
        <p>Fly through up to ten unique clinical missions drawn from your selected unit and lecture materials.</p>
      </div>
      <div className="flight-best">
        <span>ALTITUDE RECORD</span>
        <strong>{bestAltitude.toLocaleString()} <small>FT</small></strong>
        <small className="flight-record-sub">BEST SCORE {bestScore.toLocaleString()} · {completedFlights} FLIGHTS</small>
      </div>
    </div>

    <div className="flight-source-controls">
      <label>Clinical unit
        <select value={unit} onChange={(event) => changeUnit(event.target.value)}>
          {clinicalUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>Question source
        <select value={materialId} onChange={(event) => changeMaterial(event.target.value)}>
          <option value="all">All my uploaded materials for this unit</option>
          {unitMaterials.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
    </div>

    <div className="flight-source-summary">
      {loading
        ? "Loading your private study library..."
        : uploadedQuestions.length > 0
          ? <span><strong>{uploadedQuestions.length} uploaded-material questions</strong> · {unitMaterials.length} resource{unitMaterials.length === 1 ? "" : "s"} in {clinicalUnits.find((item) => item.id === unit)?.name}</span>
          : <span><strong>{activeQuestions.length} {materialId === "all" ? "core" : "source"} questions</strong> · {unitMaterials.length ? "Your uploaded materials have not generated valid questions yet." : "Upload notes to personalise the game."}</span>}
      <button className="text-link" onClick={onOpenMaterials}>Manage study materials</button>
    </div>

    {selectedMaterialNeedsQuestions && <div className="flight-material-prompt">
      <span>This material has no usable question set yet. Generate a source-based practice set to use it in your flight.</span>
      <button className="secondary-button" onClick={generateForSelected} disabled={generating}>
        {generating ? "Generating..." : "Generate 25 questions from this material"}
      </button>
    </div>}

    {materialId === "all" && ungeneratedMaterials.length > 0 && <div className="flight-material-prompt">
      <span><strong>{ungeneratedMaterials.length} materials</strong> in this unit still need questions. ClerkMe prepares questions directly from your private uploads, up to five materials per batch.</span>
      <button className="secondary-button" onClick={generateForUnitMaterials} disabled={generating}>
        {generating ? "Preparing your questions..." : "Generate questions from my materials (" + Math.min(5, ungeneratedMaterials.length) + " next)"}
      </button>
    </div>}

    {generationMessage && <p className="flight-generation-message" role="status">{generationMessage}</p>}
    {error && <p className="auth-error">{error}</p>}

    <div className="flight-dashboard">
      <div className="flight-visual-panel">
        <div className="flight-sky-label">
          <span className="live-dot"></span>
          {gameOver ? "FLIGHT COMPLETE" : started ? "FLIGHT IN PROGRESS" : "FLIGHT DECK READY"}
          <span className="flight-screen-label">LIVE QUESTION RUN</span>
        </div>

        <div className="flight-altitude">
          <span>ALTITUDE</span>
          <strong>{altitude.toLocaleString()}<small> FT</small></strong>
          <div className="altitude-track"><span style={{ height: Math.max(0, Math.min(100, altitude / 3000 * 100)) + "%" }} /></div>
        </div>

        <div className="flight-sky">
          <div className="sky-sun"></div>
          <div className="sky-cloud cloud-a"></div><div className="sky-cloud cloud-b"></div>
          <div className="sky-cloud cloud-c"></div><div className="sky-cloud cloud-d"></div>
          <div className="sky-cloud cloud-e"></div><div className="flight-route-line"></div>

          <div className="flight-question-overlay" aria-live="polite">
            <span>{gameOver ? "FLIGHT COMPLETE" : started ? "MISSION " + String(Math.min(index + 1, roundLength)).padStart(2, "0") + " OF " + roundLength : "FLIGHT QUESTION"}</span>
            <div
              ref={questionLineRef}
              className={"flight-question-line" + (questionOverflow > 8 ? " is-overflowing" : "")}
              style={questionLineStyle}
              tabIndex={0}
              aria-label={question?.question || "Your clinical question will appear here"}
              title={question?.question || "Your clinical question will appear here"}
            >
              <span>{gameOver ? "Flight complete — review your result and launch another round." : started && question ? question.question : "Your clinical question appears here when the flight begins."}</span>
            </div>
          </div>

          <div className={"flight-plane " + (gameOver && selected !== null && question && selected !== question.answerIndex ? "plane-crashed" : selected !== null && question && selected === question.answerIndex ? "plane-boost" : selected !== null ? "plane-drop" : "")} aria-label="Jet aircraft">
            <svg viewBox="0 0 120 150" role="img" aria-label="Silver jet pointing upwards">
              <defs><linearGradient id="adaptiveJetMetal" x1="0" x2="1"><stop offset="0" stopColor="#647d91" /><stop offset=".48" stopColor="#f5fbff" /><stop offset="1" stopColor="#526b80" /></linearGradient></defs>
              <path d="M60 7 C69 28 72 57 75 83 L109 111 L108 122 L72 108 L68 137 L52 137 L48 108 L12 122 L11 111 L45 83 C48 57 51 28 60 7Z" fill="url(#adaptiveJetMetal)" stroke="#d9e8f1" strokeWidth="2" />
              <path d="M60 24 C66 42 66 54 64 66 L60 74 L56 66 C54 54 54 42 60 24Z" fill="#76d9f5" />
            </svg>
          </div>

          <div className="sky-coordinate coord-two">CLIMB RATE <b>{selected === null ? "READY" : question && selected === question.answerIndex ? "+250" : selected === -1 ? "TIME OUT" : "−300"}</b></div>

          {(!started || gameOver) && <div className="flight-start-overlay">
            <div className="flight-start-icon">✈</div>
            <strong>{gameOver ? "Flight complete" : "Ready for take-off?"}</strong>
            <p>{gameOver
              ? "Review your score, then fly a fresh shuffled set of missions."
              : "Answer up to " + Math.min(MAX_ROUND_LENGTH, activeQuestions.length) + " unique questions. You have 20 seconds per question; three missed answers end the flight."}</p>
            <button className="flight-launch-button" onClick={reset} disabled={!activeQuestions.length || loading}>
              {gameOver ? "Fly again" : "Start your flight"} <span>→</span>
            </button>
          </div>}
        </div>

        <div className="flight-metrics">
          <div><span>CORRECT</span><strong>{correct}</strong></div>
          <div><span>POINTS</span><strong>{points}</strong></div>
          <div><span>BEST STREAK</span><strong>{bestStreak}</strong></div>
          <div><span>LIVES LEFT</span><strong>{Math.max(0, 3 - wrong)}</strong></div>
        </div>

        <div className="flight-question-panel" aria-live="polite">
          <div className="question-topline">
            <span>MISSION {String(Math.min(index + 1, Math.max(1, roundLength))).padStart(2, "0")} / {roundLength || 0}</span>
            <span>{question?.topic || "UNIT QUESTIONS"}</span>
          </div>
          <div className="question-progress"><span style={{ width: (roundLength ? completedMissions / roundLength * 100 : 0) + "%" }} /></div>
          <div className="question-meta-row">
            <div className="question-difficulty">{question?.difficulty || "READY"} QUESTION</div>
            {started && !gameOver && question && <span className="flight-quick-prompt">CHOOSE THE BEST ANSWER</span>}
          </div>

          {started && !gameOver && question && <div className={"flight-timer " + (timeLeft <= 5 ? "flight-timer-urgent" : "")} role="timer" aria-label={timeLeft + " seconds remaining"}>
            <div className="flight-timer-copy"><span>TIME LEFT</span><strong>{String(timeLeft).padStart(2, "0")}<small>s</small></strong></div>
            <div className="flight-timer-track"><span style={{ width: (timeLeft / QUESTION_SECONDS * 100) + "%" }} /></div>
          </div>}

          <h3>{gameOver ? "Flight complete" : started && question ? "Choose the single best answer" : "Your next clinical question is ready."}</h3>

          {started && question && !gameOver
            ? <div className="flight-options">
                {question.options.map((option, i) => <button
                  type="button"
                  key={question.id + "-" + i + "-" + option}
                  className={"flight-option " + (selected === null ? "" : i === question.answerIndex ? "option-correct" : i === selected ? "option-wrong" : "option-muted")}
                  onClick={() => answerQuestion(i)}
                  disabled={selected !== null}
                >
                  <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                  <span>{option}</span>
                  <span className="option-mark">{selected !== null && i === question.answerIndex ? "✓" : selected === i ? "×" : ""}</span>
                </button>)}
              </div>
            : <div className="flight-mission-placeholder">
                <span>◈</span>
                <p>{gameOver
                  ? "Your flight result is ready. Start another round to practise a new order with shuffled answer positions."
                  : activeQuestions.length
                    ? "The clinical question appears in the translucent flight-screen strip. Choose the best answer here."
                    : "No usable practice questions are available for this selection. Upload learning material and generate a question set."}</p>
              </div>}

          {selected !== null && question && <div className={"flight-feedback " + (selected === question.answerIndex ? "correct" : "wrong")}>
            <strong>{selected === -1 ? "Time is up — review the key point." : selected === question.answerIndex ? "Excellent — altitude gained!" : "Not quite — learn from the explanation."}</strong>
            <p>{selected === -1 ? "No answer was selected before the 20-second limit. " : ""}
              {question.explanation}
            </p>
            <div className="altitude-change">{selected === question.answerIndex ? "+250" : "−300"} FT</div>
            {!gameOver && <button type="button" className="flight-next-button" onClick={advanceQuestion}>Next mission <span>→</span></button>}
          </div>}

          {!started && !gameOver && <div className="flight-howto">
            <span>QUICK RULES</span>
            <p><b>Correct answer</b> <i>+</i> 250 ft and points</p>
            <p><b>Wrong or timed out</b> <i>−</i> 300 ft</p>
            <p><b>Three failed answers</b> ends the flight.</p>
            <p><b>Up to ten unique missions</b> per flight; no repeats in the same round.</p>
          </div>}

          {gameOver && <div className="flight-game-over-note">
            <strong>Flight summary · {correct + wrong} missions attempted</strong>
            <p>{correct} correct · {wrong} missed · {accuracy}% accuracy · {points} points · best streak {bestStreak}. Altitude record: {bestAltitude.toLocaleString()} ft. Best score: {bestScore.toLocaleString()}.</p>
            <button type="button" className="flight-next-button" onClick={reset} disabled={!activeQuestions.length}>Launch another flight <span>→</span></button>
          </div>}
        </div>
      </div>
    </div>

    <div className="flight-quiz-footer">
      <span><i></i> EDUCATIONAL GAME · UNIT-SPECIFIC PRACTICE</span>
      <span>{activeQuestions.length} QUESTIONS AVAILABLE · UP TO {Math.min(MAX_ROUND_LENGTH, activeQuestions.length)} UNIQUE MISSIONS</span>
    </div>
  </section>;
}
