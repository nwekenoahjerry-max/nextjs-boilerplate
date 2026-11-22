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
type FlightQuestion = GeneratedQuestion & {
  id: string;
  source: string;
  statement?: string;
  correctStatement?: string;
};
type FlightAttempt = {
  id: string;
  question: string;
  statement: string;
  correctStatement: string;
  options: string[];
  answerIndex: number;
  selectedIndex: number | null;
  timedOut: boolean;
  isCorrect: boolean;
  explanation: string;
  topic: string;
  difficulty: string;
  source: string;
};
type StudyMaterial = {
  id: string;
  title: string;
  unit: string;
  questions?: GeneratedQuestion[];
};

const QUESTION_SECONDS = 8;
const MAX_ROUND_LENGTH = 10;
const INITIAL_SPEED_KNOTS = 420;
const MIN_SPEED_KNOTS = 240;
const MAX_SPEED_KNOTS = 780;
const NEXT_QUESTION_DELAY_MS = 280;

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

function makeTrueFalseFlightQuestion(question: FlightQuestion, position: number): FlightQuestion {
  // Balance true and false statements across the shuffled round.
  const statementIsTrue = position % 2 === 0;
  const incorrectIndexes = question.options
    .map((_, optionIndex) => optionIndex)
    .filter((optionIndex) => optionIndex !== question.answerIndex);
  const selectedStatementIndex = statementIsTrue
    ? question.answerIndex
    : incorrectIndexes[Math.floor(Math.random() * incorrectIndexes.length)];
  return {
    ...question,
    statement: question.options[selectedStatementIndex],
    correctStatement: question.options[question.answerIndex],
    options: ["True", "False"],
    answerIndex: statementIsTrue ? 0 : 1
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
  const [answerHistory, setAnswerHistory] = useState<FlightAttempt[]>([]);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [flightSpeed, setFlightSpeed] = useState(INITIAL_SPEED_KNOTS);
  const [altitude, setAltitude] = useState(1000);
  const [jetMotion, setJetMotion] = useState<"cruise" | "boost" | "drop">("cruise");
  const [jetAnimationKey, setJetAnimationKey] = useState(0);
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
  const lastFirstQuestionRef = useRef<string | null>(null);
  const answerLockedRef = useRef(false);

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

  const customUnits = useMemo(
    () => [...new Set(materials.map(item=>item.unit).filter(value=>value.startsWith("custom:")))]
      .sort((a,b)=>a.slice("custom:".length).localeCompare(b.slice("custom:".length),"en",{sensitivity:"base"})),
    [materials]
  );
  const unitName = (value:string) => value.startsWith("custom:")
    ? value.slice("custom:".length)
    : clinicalUnits.find(item=>item.id===value)?.name || value;
  const isCustomGame = unit.startsWith("custom:");
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
    setAnswerHistory([]);
    setTimeLeft(QUESTION_SECONDS);
    setFlightSpeed(INITIAL_SPEED_KNOTS);
    setAltitude(1000);
    setJetMotion("cruise");
    setCorrect(0);
    setWrong(0);
    setStreak(0);
    setBestStreak(0);
    setPoints(0);
    setGameOver(false);
    setGenerationMessage("");
  };

  const reset = () => {
    const deck = shuffleQuestions(activeQuestions).map((item, position) => makeTrueFalseFlightQuestion(item, position));
    if (deck.length > 1 && deck[0]?.id === lastFirstQuestionRef.current) {
      [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    lastFirstQuestionRef.current = deck[0]?.id ?? null;
    answerLockedRef.current = false;
    setQuestionDeck(deck);
    setStarted(true);
    setIndex(0);
    setSelected(null);
    setAnswerHistory([]);
    setTimeLeft(QUESTION_SECONDS);
    setFlightSpeed(INITIAL_SPEED_KNOTS);
    setAltitude(1000);
    setJetMotion("cruise");
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
    setJetAnimationKey((value) => value + 1);
    setSelected(option);
    setAnswerHistory((current) => [...current, {
      id: question.id,
      question: question.question,
      statement: question.statement || "",
      correctStatement: question.correctStatement || question.statement || "",
      options: [...question.options],
      answerIndex: question.answerIndex,
      selectedIndex: option >= 0 ? option : null,
      timedOut: option < 0,
      isCorrect: option === question.answerIndex,
      explanation: question.explanation,
      topic: question.topic,
      difficulty: question.difficulty,
      source: question.source
    }]);
    void fetch("/api/activity", { method: "POST", credentials: "same-origin" }).catch(() => {});

    if (option === question.answerIndex) {
      setJetMotion("boost");
      const nextAltitude = altitude + 250;
      const nextStreak = streak + 1;
      setAltitude(nextAltitude);
      setBestAltitude((value) => Math.max(value, nextAltitude));
      setFlightSpeed((value) => Math.min(MAX_SPEED_KNOTS, value + 45));
      setCorrect((value) => value + 1);
      setStreak(nextStreak);
      setBestStreak((value) => Math.max(value, nextStreak));
      setPoints((value) => value + 100 + Math.min(streak, 4) * 25);
    } else {
      setJetMotion("drop");
      const nextWrong = wrong + 1;
      setWrong(nextWrong);
      setStreak(0);
      setPoints((value) => Math.max(0, value - 25));
      setAltitude(nextWrong >= 3 ? 0 : Math.max(0, altitude - 300));
      setFlightSpeed((value) => Math.max(MIN_SPEED_KNOTS, value - 60));
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
    const timer = window.setTimeout(advanceQuestion, NEXT_QUESTION_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [selected, gameOver, advanceQuestion]);

  useEffect(() => {
    if (jetMotion === "cruise" || (gameOver && wrong >= 3)) return;
    const timer = window.setTimeout(() => setJetMotion("cruise"), 760);
    return () => window.clearTimeout(timer);
  }, [jetMotion, gameOver, wrong, index]);

  useEffect(() => {
    if (!started || gameOver || selected !== null || !question) return;
    if (timeLeft <= 0) {
      answerQuestion(-1);
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [started, gameOver, selected, question, timeLeft, answerQuestion]);

  const planeOffset = altitude >= 1000
    ? -Math.min(68, (altitude - 1000) * 0.026)
    : Math.min(58, (1000 - altitude) * 0.055);
  const flightPlaneStyle = { "--jet-offset": planeOffset + "px" } as CSSProperties;
  const flightSkyStyle = { "--flight-cloud-duration": (18 * INITIAL_SPEED_KNOTS / flightSpeed).toFixed(2) + "s" } as CSSProperties;
  const completedMissions = Math.min(roundLength, index + (selected !== null ? 1 : 0));
  const accuracy = correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0;

  return <section className={"flight-quiz" + (started && !gameOver ? " flight-playing" : "") + (gameOver ? " flight-game-over" : "")}>
    <div className="flight-quiz-heading">
      <div>
        <span className="eyebrow">ADAPTIVE QUESTION GAME</span>
        <h2>Skyward <span>Flight Academy</span></h2>
        <p>Fly through up to ten unique missions drawn from your selected subject and uploaded materials.</p>
      </div>
      <div className="flight-best">
        <span>ALTITUDE RECORD</span>
        <strong>{bestAltitude.toLocaleString()} <small>FT</small></strong>
        <small className="flight-record-sub">BEST SCORE {bestScore.toLocaleString()} · {completedFlights} FLIGHTS</small>
      </div>
    </div>

    <div className="flight-source-controls">
      <label>Subject / unit
        <select value={unit} onChange={(event) => changeUnit(event.target.value)}>
          <optgroup label="Clinical & health sciences">
            {clinicalUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </optgroup>
          {customUnits.length>0&&<optgroup label="My general-study subjects">
            {customUnits.map(value=><option key={value} value={value}>{unitName(value)}</option>)}
          </optgroup>}
        </select>
      </label>
      <label>Question source
        <select value={materialId} onChange={(event) => changeMaterial(event.target.value)}>
          <option value="all">All my uploaded materials for this subject</option>
          {unitMaterials.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
    </div>

    <div className="flight-source-summary">
      {loading
        ? "Loading your private study library..."
        : uploadedQuestions.length > 0
          ? <span><strong>{uploadedQuestions.length} uploaded-material questions</strong> · {unitMaterials.length} resource{unitMaterials.length === 1 ? "" : "s"} in {unitName(unit)}</span>
          : <span><strong>{activeQuestions.length} {materialId === "all" ? "core" : "source"} questions</strong> · {unitMaterials.length ? "Your uploaded materials have not generated valid questions yet." : "Add a subject resource and generate questions to personalise the game."}</span>}
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

        <div className="flight-sky" style={flightSkyStyle}>
          <div className="sky-sun"></div>
          <div className="sky-cloud cloud-a"></div><div className="sky-cloud cloud-b"></div>
          <div className="sky-cloud cloud-c"></div><div className="sky-cloud cloud-d"></div>
          <div className="sky-cloud cloud-e"></div><div className="flight-route-line"></div>

          <div key={jetAnimationKey} className={"flight-plane " + (flightSpeed >= 600 ? "plane-fast " : "") + (gameOver && wrong >= 3 ? "plane-crashed" : "plane-" + jetMotion)} style={flightPlaneStyle} aria-label="Jet aircraft">
            <svg viewBox="0 0 120 150" role="img" aria-label="Silver jet pointing upwards">
              <defs><linearGradient id="adaptiveJetMetal" x1="0" x2="1"><stop offset="0" stopColor="#647d91" /><stop offset=".48" stopColor="#f5fbff" /><stop offset="1" stopColor="#526b80" /></linearGradient></defs>
              <path d="M60 7 C69 28 72 57 75 83 L109 111 L108 122 L72 108 L68 137 L52 137 L48 108 L12 122 L11 111 L45 83 C48 57 51 28 60 7Z" fill="url(#adaptiveJetMetal)" stroke="#d9e8f1" strokeWidth="2" />
              <path d="M60 24 C66 42 66 54 64 66 L60 74 L56 66 C54 54 54 42 60 24Z" fill="#76d9f5" />
            </svg>
          </div>

          <div className="flight-speed-readout" aria-live="polite"><span>AIR SPEED</span><strong>{flightSpeed.toLocaleString()} <small>KT</small></strong></div>
        <div className="sky-coordinate coord-two">MISSION STATUS <b>{selected === null ? "READY" : "LOCKED"}</b></div>

          {(!started || gameOver) && <div className="flight-start-overlay">
            <div className="flight-start-icon">✈</div>
            <strong>{gameOver ? "Flight complete" : "Ready for take-off?"}</strong>
            <p>{gameOver
              ? "Review your score, then fly a fresh shuffled set of missions."
              : loading
                ? "Getting your question set ready…"
                : !activeQuestions.length
                  ? unitMaterials.length
                    ? "Your source is saved, but there are no usable questions yet. Generate a practice set from the material above to unlock your flight."
                    : "Choose a subject with questions or add a study resource to your library. Generate a question set to unlock take-off."
                  : "Answer up to " + Math.min(MAX_ROUND_LENGTH, activeQuestions.length) + " unique questions. You have 8 seconds per statement; three missed answers end the flight. Correct answers are revealed after the flight."}</p>
            <button type="button" className="flight-launch-button" onClick={reset} disabled={!activeQuestions.length || loading} aria-label={gameOver ? "Fly another round" : "Start Flight Academy game"}>
              {gameOver ? "Fly again" : loading ? "Preparing…" : !activeQuestions.length ? "Questions needed first" : "Start your flight"} <span>→</span>
            </button>
            {!gameOver && !loading && !activeQuestions.length && <button type="button" className="flight-launch-secondary" onClick={onOpenMaterials}>Open study library <span>→</span></button>}
          </div>}
        </div>

        <div className="flight-metrics">
          <div><span>CORRECT</span><strong>{correct}</strong></div>
          <div><span>POINTS</span><strong>{points}</strong></div>
          <div><span>BEST STREAK</span><strong>{bestStreak}</strong></div>
          <div><span>LIVES LEFT</span><strong>{Math.max(0, 3 - wrong)}</strong></div>
        </div>

      </div>
      <div className="flight-question-panel" aria-live="polite">
          <div className="question-topline">
            <span>MISSION {String(Math.min(index + 1, Math.max(1, roundLength))).padStart(2, "0")} / {roundLength || 0}</span>
            <span>{question?.topic || "SUBJECT QUESTIONS"}</span>
          </div>
          <div className="question-progress"><span style={{ width: (roundLength ? completedMissions / roundLength * 100 : 0) + "%" }} /></div>
          <div className="question-meta-row">
            <div className="question-difficulty">{question?.difficulty || "READY"} QUESTION</div>
            {started && !gameOver && question && <span className="flight-quick-prompt">CHOOSE TRUE OR FALSE</span>}
          </div>

          {started && !gameOver && question && <div className={"flight-timer " + (timeLeft <= 5 ? "flight-timer-urgent" : "")} role="timer" aria-label={timeLeft + " seconds remaining"}>
            <div className="flight-timer-copy"><span>TIME LEFT</span><strong>{String(timeLeft).padStart(2, "0")}<small>s</small></strong></div>
            <div className="flight-timer-track"><span style={{ width: (timeLeft / QUESTION_SECONDS * 100) + "%" }} /></div>
          </div>}

          <h3>{gameOver ? "Flight complete" : selected !== null ? "Answer recorded" : started && question ? "Is the statement true or false?" : "Your next statement is ready."}</h3>

          {started && question && !gameOver
            ? <>
                <div className="flight-statement-context">
                  <span>QUESTION CONTEXT</span>
                  <p>{question.question}</p>
                </div>
                <div className="flight-statement-card">
                  <span>STATEMENT TO JUDGE</span>
                  <p>{question.statement}</p>
                </div>
                <div className="flight-options flight-true-false-options">
                  {question.options.map((option, i) => <button
                    type="button"
                    key={question.id + "-tf-" + option}
                    className={"flight-option flight-tf-option " + (i === 0 ? "flight-true" : "flight-false") + (selected === null ? "" : i === selected ? " option-selected" : " option-locked")}
                    onClick={() => answerQuestion(i)}
                    disabled={selected !== null}
                    aria-pressed={selected === i}
                  >
                    <span className="flight-tf-symbol" aria-hidden="true">{i === 0 ? "✓" : "×"}</span>
                    <strong>{option}</strong>
                    <span className="option-mark">{selected === i ? "LOCKED" : "TAP TO ANSWER"}</span>
                  </button>)}
                </div>
              </>
            : <div className="flight-mission-placeholder">
                <span>◈</span>
                <p>{gameOver
                  ? "Your flight result is ready. Start another round to practise a fresh set of statements."
                  : activeQuestions.length
                    ? "Your next statement will appear in this question card below the flight deck."
                    : "No usable questions are available for this selection yet. Add a subject resource and generate a question set."}</p>
              </div>}

          {selected !== null && question && <div className="flight-answer-locked" role="status">
            <strong>{selected === -1 ? "Mission timed out." : "Answer locked in."}</strong>
            <p>{gameOver ? "Your flight has ended. The answer key and explanations are now available in the review below." : "Next mission launching automatically. Correct answers stay hidden until the flight ends."}</p>
          </div>}

          {!started && !gameOver && <div className="flight-howto">
            <span>QUICK RULES</span>
            <p><b>True statement</b> <i>↑</i> +250 ft, points and 45 KT speed</p>
            <p><b>False statement</b> <i>↓</i> −300 ft and 60 KT speed</p>
            <p><b>Eight seconds</b> per statement; the next appears automatically.</p>
            <p><b>Three failed answers</b> ends the flight.</p>
            <p><b>Up to ten unique statements</b> per flight; no repeats in the same round.</p>
            <p><b>Answer key and explanations</b> appear only after the flight ends.</p>
          </div>}

          {gameOver && <div className="flight-game-over-note">
            <strong>Flight summary · {correct + wrong} missions attempted</strong>
            <p>{correct} correct · {wrong} missed · {accuracy}% accuracy · {points} points · best streak {bestStreak}. Altitude record: {bestAltitude.toLocaleString()} ft. Best score: {bestScore.toLocaleString()}.</p>
            <button type="button" className="flight-replay-button" onClick={reset} disabled={!activeQuestions.length}>Launch another flight <span>→</span></button>
          </div>}
          {gameOver && answerHistory.length > 0 && <section className="flight-answer-review" aria-label="End-of-flight answer review">
            <div className="flight-answer-review-heading">
              <div>
                <span className="eyebrow">ANSWER KEY UNLOCKED</span>
                <h4>Review your answers</h4>
                <p>The tested statements, correct True/False judgements and explanations are revealed here, after the flight.</p>
              </div>
              <strong>{answerHistory.filter((attempt) => attempt.isCorrect).length}/{answerHistory.length} correct</strong>
            </div>
            <div className="flight-answer-review-list">
              {answerHistory.map((attempt, attemptIndex) => <article className="flight-answer-review-card" key={attempt.id + "-" + attemptIndex}>
                <div className="flight-answer-review-meta">
                  <span>MISSION {String(attemptIndex + 1).padStart(2, "0")} · {attempt.topic || "SUBJECT REVIEW"}</span>
                  <strong className={attempt.isCorrect ? "is-correct" : "is-incorrect"}>
                    {attempt.isCorrect ? "Correct" : attempt.timedOut ? "Timed out" : "Incorrect"}
                  </strong>
                </div>
                <h5>{attempt.question}</h5>
                <div className="flight-review-statement"><span>STATEMENT TESTED</span><p>{attempt.statement}</p></div>
                <ol>
                  {attempt.options.map((option, optionIndex) => <li key={attempt.id + "-answer-" + optionIndex} className={optionIndex === attempt.answerIndex ? "is-correct" : optionIndex === attempt.selectedIndex ? "is-selected" : ""}>
                    <span><b>{option}.</b></span>
                    {optionIndex === attempt.answerIndex
                      ? <small>Correct answer</small>
                      : optionIndex === attempt.selectedIndex
                        ? <small>Your answer</small>
                        : null}
                  </li>)}
                </ol>
                {attempt.answerIndex === 1 && <p className="flight-answer-correction"><b>Correct statement:</b> {attempt.correctStatement}</p>}
                {attempt.timedOut && <small className="flight-answer-timeout">No answer was selected before time expired.</small>}
                <p className="flight-answer-explanation"><b>Explanation:</b> {attempt.explanation}</p>
                <small className="flight-answer-source">Source: {attempt.source}</small>
              </article>)}
            </div>
          </section>}
        </div>
    </div>

    <div className="flight-quiz-footer">
      <span><i></i> EDUCATIONAL GAME · SUBJECT-SPECIFIC PRACTICE</span>
      <span>{activeQuestions.length} QUESTIONS AVAILABLE · UP TO {Math.min(MAX_ROUND_LENGTH, activeQuestions.length)} UNIQUE MISSIONS</span>
    </div>
  </section>;
}
