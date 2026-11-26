"use client";

import { useEffect, useMemo, useState } from "react";
import { clinicalUnits } from "../lib/learning-content";
import "./flashcards.css";

type ReviewStatus = "new" | "known" | "review";
type Flashcard = { id: string; front: string; back: string; status: ReviewStatus; reviewCount: number; lastReviewedAt?: number; source?: string };
type FlashcardDeck = { id: string; title: string; unit: string; createdAt: number; updatedAt: number; cards: Flashcard[] };
type FlashcardDraft = { title?: string; unit?: string; cards?: Array<{ front: string; back: string }> };
type SourceMaterial = { id:string; title:string; unit:string; hasSummary?:boolean };

const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "fc-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
const storageKey = (userKey: string) => "clerkme:flashcards:v1:" + userKey;
const pendingKey = (userKey: string) => "clerkme:flashcards:pending:" + userKey;

function cleanCards(value: unknown): Flashcard[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: any) => {
    if (!item || typeof item.front !== "string" || typeof item.back !== "string") return [];
    const front = item.front.trim(), back = item.back.trim();
    if (!front || !back) return [];
    return [{
      id: typeof item.id === "string" ? item.id : makeId(),
      front: front.slice(0, 1800),
      back: back.slice(0, 2400),
      status: item.status === "known" || item.status === "review" ? item.status : "new",
      reviewCount: Math.max(0, Number(item.reviewCount) || 0),
      ...(Number.isFinite(Number(item.lastReviewedAt)) ? { lastReviewedAt: Number(item.lastReviewedAt) } : {}),
      ...(typeof item.source === "string" ? { source: item.source } : {}),
    }];
  });
}

function parsePairs(raw: string) {
  return raw.split(/\r?\n/).map(line => {
    const separator = line.indexOf("|");
    return separator > 0 ? { front: line.slice(0, separator).trim(), back: line.slice(separator + 1).trim() } : null;
  }).filter((item): item is { front: string; back: string } => Boolean(item?.front && item?.back)).slice(0, 60);
}

function unitLabel(unit: string) {
  return clinicalUnits.find(item => item.id === unit)?.name || unit || "General revision";
}

export default function FlashcardsPanel({ userKey }: { userKey: string }) {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [view, setView] = useState<"overview" | "study" | "manage">("overview");
  const [showCreate, setShowCreate] = useState(false);
  const [deckTitle, setDeckTitle] = useState("");
  const [deckUnit, setDeckUnit] = useState("general-medicine");
  const [bulkCards, setBulkCards] = useState("");
  const [deckSearch, setDeckSearch] = useState("");
  const [studyQueue, setStudyQueue] = useState<string[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionScore, setSessionScore] = useState({ known: 0, review: 0, skipped: 0 });
  const [editorId, setEditorId] = useState("");
  const [frontDraft, setFrontDraft] = useState("");
  const [backDraft, setBackDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [sourceMaterials, setSourceMaterials] = useState<SourceMaterial[]>([]);
  const [sourceMaterialId, setSourceMaterialId] = useState("");
  const [sourceCards, setSourceCards] = useState<Array<{front:string;back:string;source:string}>>([]);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUnit, setSourceUnit] = useState("general-medicine");
  const [sourceError, setSourceError] = useState("");
  const [sourceGenerating, setSourceGenerating] = useState(false);


  useEffect(() => {
    let cancelled = false;
    fetch("/api/learning/materials", { credentials:"same-origin", cache:"no-store" })
      .then(async response => {
        const raw = await response.text(); const data = raw ? JSON.parse(raw) : {};
        if (!response.ok) throw new Error(data.error || "Could not load uploaded materials.");
        return data;
      })
      .then(data => { if (!cancelled) setSourceMaterials(Array.isArray(data.materials) ? data.materials : []); })
      .catch(error => { if (!cancelled) setSourceError(error instanceof Error ? error.message : "Could not load uploaded materials."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(userKey));
      if (raw) {
        const saved = JSON.parse(raw);
        setDecks((Array.isArray(saved) ? saved : []).flatMap((deck: any) => {
          if (!deck || typeof deck.id !== "string" || typeof deck.title !== "string") return [];
          return [{
            id: deck.id, title: deck.title,
            unit: typeof deck.unit === "string" ? deck.unit : "general-medicine",
            createdAt: Number(deck.createdAt) || Date.now(),
            updatedAt: Number(deck.updatedAt) || Date.now(),
            cards: cleanCards(deck.cards),
          }];
        }));
      }
    } catch {
      setNotice("Saved decks could not be read from this browser.");
    }
    setHydrated(true);
  }, [userKey]);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(storageKey(userKey), JSON.stringify(decks)); }
    catch { setNotice("Browser storage is full. Remove older decks to continue saving."); }
  }, [decks, hydrated, userKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const raw = window.localStorage.getItem(pendingKey(userKey));
      if (!raw) return;
      window.localStorage.removeItem(pendingKey(userKey));
      const draft = JSON.parse(raw) as FlashcardDraft;
      const cards = cleanCards(draft.cards);
      if (!cards.length) return;
      const now = Date.now();
      const deck: FlashcardDeck = {
        id: makeId(), title: (draft.title || "Study guide revision").trim().slice(0, 90) || "Study guide revision",
        unit: draft.unit || "general-medicine", createdAt: now, updatedAt: now, cards,
      };
      setDecks(current => [deck, ...current]);
      setSelectedDeckId(deck.id);
      setView("manage");
      setShowCreate(false);
      setNotice(cards.length + " source-based flashcards added to your library.");
    } catch {
      setNotice("ClerkME could not import those study-guide cards. Please try again.");
    }
  }, [hydrated, userKey]);

  const selectedDeck = decks.find(deck => deck.id === selectedDeckId) || null;

  const generateFromUploadedMaterial = async () => {
    if (!sourceMaterialId) { setSourceError("Choose an uploaded material first."); return; }
    setSourceGenerating(true); setSourceError(""); setSourceCards([]);
    try {
      const response = await fetch("/api/learning/materials?id=" + encodeURIComponent(sourceMaterialId) + "&include=study", {credentials:"same-origin",cache:"no-store"});
      const raw = await response.text(); const data = raw ? JSON.parse(raw) : {};
      if (!response.ok) throw new Error(data.error || "Could not open this study material.");
      const material = data.material || {};
      const summary = material.summary;
      if (!summary) throw new Error("This material has no generated study guide yet. Open My materials, generate its study guide, then return here.");
      const candidates:Array<{front:string;back:string;source:string}> = [
        ...(summary.revisionQuestions || []).map((item:any) => ({front:item.question,back:item.answer,source:"Revision questions"})),
        ...((summary.examFocus && summary.examFocus.vivaQuestions) || []).map((item:any) => ({front:item.question,back:item.answer,source:"Viva practice"})),
        ...(summary.sections || []).flatMap((section:any) => (section.subsections || []).filter((item:any) => item.recallQuestion && item.recallAnswer).map((item:any) => ({front:item.recallQuestion,back:item.recallAnswer,source:section.heading + " · " + item.heading}))),
        ...(summary.keyTerms || []).map((item:any) => ({front:"Define " + item.term,back:item.meaning,source:"Key terms"}))
      ];
      const seen = new Set<string>();
      const clean = candidates.filter(item => typeof item.front === "string" && typeof item.back === "string" && item.front.trim() && item.back.trim()).filter(item => {
        const key = (item.front + "|" + item.back).toLowerCase().replace(/\s+/g," ");
        if (seen.has(key)) return false; seen.add(key); return true;
      }).slice(0,60);
      if (!clean.length) throw new Error("No suitable recall questions were found. Generate a detailed guide with recall questions and key terms first.");
      setSourceCards(clean); setSourceTitle(material.title || "Uploaded material revision"); setSourceUnit(material.unit || "general-medicine");
    } catch(error) { setSourceError(error instanceof Error ? error.message : "Flashcards could not be prepared from this material."); }
    finally { setSourceGenerating(false); }
  };

  const saveSourceDeck = () => {
    if (!sourceCards.length) return;
    const now = Date.now();
    const deck:FlashcardDeck = {id:makeId(),title:sourceTitle.slice(0,90),unit:sourceUnit,createdAt:now,updatedAt:now,cards:sourceCards.map(item=>({id:makeId(),front:item.front.trim().slice(0,1800),back:item.back.trim().slice(0,2400),status:"new" as ReviewStatus,reviewCount:0,source:item.source}))};
    setDecks(current => [deck,...current]); setSelectedDeckId(deck.id); setView("manage"); setSourceCards([]);
    setSourceMaterialId(""); setNotice(deck.cards.length + " flashcards created from " + deck.title + ".");
  };

  const visibleDecks = useMemo(() => {
    const query = deckSearch.trim().toLowerCase();
    return query ? decks.filter(deck => (deck.title + " " + unitLabel(deck.unit)).toLowerCase().includes(query)) : decks;
  }, [decks, deckSearch]);
  const totalCards = decks.reduce((sum, deck) => sum + deck.cards.length, 0);
  const masteredCards = decks.reduce((sum, deck) => sum + deck.cards.filter(card => card.status === "known").length, 0);
  const reviewCards = decks.reduce((sum, deck) => sum + deck.cards.filter(card => card.status === "review").length, 0);
  const currentCard = selectedDeck && studyQueue[cardIndex] ? selectedDeck.cards.find(card => card.id === studyQueue[cardIndex]) || null : null;
  const sessionFinished = view === "study" && studyQueue.length > 0 && cardIndex >= studyQueue.length;

  const updateDeck = (deckId: string, updater: (deck: FlashcardDeck) => FlashcardDeck) => {
    setDecks(current => current.map(deck => deck.id === deckId ? updater(deck) : deck));
  };

  const createDeck = () => {
    const title = deckTitle.trim();
    if (!title) { setNotice("Give your deck a name before saving it."); return; }
    const cards = parsePairs(bulkCards).map(item => ({ id: makeId(), front: item.front.slice(0, 1800), back: item.back.slice(0, 2400), status: "new" as ReviewStatus, reviewCount: 0 }));
    const now = Date.now();
    const deck: FlashcardDeck = { id: makeId(), title: title.slice(0, 90), unit: deckUnit, createdAt: now, updatedAt: now, cards };
    setDecks(current => [deck, ...current]);
    setSelectedDeckId(deck.id);
    setView("manage");
    setShowCreate(false);
    setDeckTitle("");
    setBulkCards("");
    setNotice(cards.length ? "Your deck and " + cards.length + " cards have been saved." : "Deck created. Add your first card below.");
  };

  const openDeck = (deck: FlashcardDeck, nextView: "study" | "manage") => {
    setSelectedDeckId(deck.id);
    setView(nextView);
    setNotice("");
    if (nextView === "manage") { setEditorId(""); setFrontDraft(""); setBackDraft(""); }
  };

  const startStudy = (deck: FlashcardDeck, reviewOnly = false, shuffle = false) => {
    let cards = reviewOnly ? deck.cards.filter(card => card.status === "review") : deck.cards;
    if (reviewOnly && !cards.length) { setNotice("There are no flagged cards in this deck. Mark a card for review during your next session."); return; }
    if (!cards.length) { setNotice("Add at least one question and answer before starting a study session."); setView("manage"); setSelectedDeckId(deck.id); return; }
    if (shuffle) cards = [...cards].sort(() => Math.random() - 0.5);
    setSelectedDeckId(deck.id);
    setStudyQueue(cards.map(card => card.id));
    setCardIndex(0);
    setFlipped(false);
    setSessionScore({ known: 0, review: 0, skipped: 0 });
    setView("study");
    setNotice("");
  };

  const rateCard = (status: "known" | "review") => {
    if (!selectedDeck || !currentCard) return;
    updateDeck(selectedDeck.id, deck => ({
      ...deck, updatedAt: Date.now(),
      cards: deck.cards.map(card => card.id === currentCard.id ? { ...card, status, reviewCount: card.reviewCount + 1, lastReviewedAt: Date.now() } : card),
    }));
    setSessionScore(score => ({ ...score, [status]: score[status] + 1 }));
    setCardIndex(index => index + 1);
    setFlipped(false);
  };

  const skipCard = () => { setSessionScore(score => ({ ...score, skipped: score.skipped + 1 })); setCardIndex(index => index + 1); setFlipped(false); };

  const editCard = (card: Flashcard) => {
    setEditorId(card.id); setFrontDraft(card.front); setBackDraft(card.back);
    window.requestAnimationFrame(() => document.getElementById("flashcard-editor")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const saveCard = () => {
    if (!selectedDeck) return;
    const front = frontDraft.trim(), back = backDraft.trim();
    if (!front || !back) { setNotice("Both the question and answer are required."); return; }
    if (editorId) {
      updateDeck(selectedDeck.id, deck => ({ ...deck, updatedAt: Date.now(), cards: deck.cards.map(card => card.id === editorId ? { ...card, front, back } : card) }));
      setNotice("Flashcard updated.");
    } else {
      updateDeck(selectedDeck.id, deck => ({ ...deck, updatedAt: Date.now(), cards: [...deck.cards, { id: makeId(), front, back, status: "new", reviewCount: 0 }] }));
      setNotice("Flashcard added.");
    }
    setEditorId(""); setFrontDraft(""); setBackDraft("");
  };

  const deleteCard = (cardId: string) => {
    if (!selectedDeck || !window.confirm("Delete this flashcard? This cannot be undone.")) return;
    updateDeck(selectedDeck.id, deck => ({ ...deck, updatedAt: Date.now(), cards: deck.cards.filter(card => card.id !== cardId) }));
  };

  const deleteDeck = (deck: FlashcardDeck) => {
    if (!window.confirm("Delete the deck “" + deck.title + "” and all its cards? This cannot be undone.")) return;
    setDecks(current => current.filter(item => item.id !== deck.id));
    if (selectedDeckId === deck.id) { setSelectedDeckId(""); setView("overview"); }
  };

  if (!hydrated) return <section className="flashcards-panel"><div className="flashcards-loading">Preparing your flashcard library…</div></section>;

  if (view !== "overview" && selectedDeck) {
    return (
      <section className="flashcards-panel">
        <div className="flashcards-breadcrumb"><button type="button" onClick={() => { setView("overview"); setNotice(""); }}>← All decks</button><span>/</span><span>{selectedDeck.title}</span></div>
        <header className="flashcards-page-heading">
          <div><span className="flashcards-eyebrow">ACTIVE RECALL WORKSPACE</span><h1>{selectedDeck.title}</h1><p>{unitLabel(selectedDeck.unit)} · {selectedDeck.cards.length} cards</p></div>
          <div className="flashcards-heading-actions"><button type="button" className="flashcards-secondary-button" onClick={() => { if (view === "manage") startStudy(selectedDeck); else setView("manage"); }}>{view === "manage" ? "Study this deck" : "Manage cards"}</button></div>
        </header>
        {notice && <p className="flashcards-notice" role="status">{notice}</p>}

        {view === "study" && (
          sessionFinished ? (
            <div className="flashcards-session-complete">
              <span className="flashcards-complete-mark">✓</span><span className="flashcards-eyebrow">SESSION COMPLETE</span>
              <h2>Good work. Keep the recall active.</h2><p>You reviewed {studyQueue.length} cards in this session.</p>
              <div className="flashcards-score-grid"><div><strong>{sessionScore.known}</strong><span>Known</span></div><div><strong>{sessionScore.review}</strong><span>Need practice</span></div><div><strong>{sessionScore.skipped}</strong><span>Skipped</span></div></div>
              <div className="flashcards-session-actions">
                <button type="button" className="flashcards-primary-button" onClick={() => startStudy(selectedDeck)}>Study the deck again</button>
                {selectedDeck.cards.some(card => card.status === "review") && <button type="button" className="flashcards-secondary-button" onClick={() => startStudy(selectedDeck, true)}>Review flagged cards</button>}
                <button type="button" className="flashcards-text-button" onClick={() => setView("overview")}>Back to all decks</button>
              </div>
            </div>
          ) : currentCard ? (
            <div className="flashcards-study-layout">
              <div className="flashcards-study-toolbar"><span>CARD {cardIndex + 1} <i>OF</i> {studyQueue.length}</span><span>{Math.round((cardIndex / studyQueue.length) * 100)}% complete</span></div>
              <div className="flashcards-progress-track"><span style={{ width: (cardIndex / studyQueue.length) * 100 + "%" }}/></div>
              <div className="flashcards-study-intro">
                <span className="flashcards-eyebrow">ACTIVE RECALL</span>
                <p>Read the question, think of your answer, then flip the card.</p>
              </div>
              <button
                type="button"
                className="flashcards-flip-trigger"
                onClick={() => setFlipped(value => !value)}
                aria-label={flipped ? "Flip back to the question" : "Flip card to reveal the answer"}
                aria-pressed={flipped}
              >
                <span className={"flashcards-flip-inner" + (flipped ? " is-flipped" : "")}>
                  <span className="flashcards-flip-face flashcards-flip-front" aria-hidden={flipped}>
                    <span className="flashcards-flip-topline">
                      <span className="flashcards-flip-label"><i>?</i> QUESTION</span>
                      <span className="flashcards-flip-count">THINK IT THROUGH</span>
                    </span>
                    <span className="flashcards-flip-content">{currentCard.front}</span>
                    <span className="flashcards-flip-bottom"><i>↻</i><span>Tap anywhere to reveal the answer</span></span>
                  </span>
                  <span className="flashcards-flip-face flashcards-flip-back" aria-hidden={!flipped}>
                    <span className="flashcards-flip-topline">
                      <span className="flashcards-flip-label"><i>✓</i> ANSWER</span>
                      <span className="flashcards-flip-count">CHECK YOUR RECALL</span>
                    </span>
                    <span className="flashcards-flip-content">{currentCard.back}</span>
                    <span className="flashcards-flip-bottom">
                      {currentCard.source ? <span className="flashcards-flip-source">{currentCard.source}</span> : <span>Review the key point</span>}
                      <span>Tap to return to question</span>
                    </span>
                  </span>
                </span>
              </button>
              <div className="flashcards-study-actions">
                {!flipped ? <button type="button" className="flashcards-primary-button" onClick={() => setFlipped(true)}>Reveal answer <span>↗</span></button>
                  : <><button type="button" className="flashcards-review-button" onClick={() => rateCard("review")}>↻ Need more practice</button><button type="button" className="flashcards-known-button" onClick={() => rateCard("known")}>✓ I knew it</button></>}
              </div>
              <div className="flashcards-study-footer"><button type="button" onClick={() => { setCardIndex(index => Math.max(0, index - 1)); setFlipped(false); }} disabled={cardIndex === 0}>← Previous</button><button type="button" onClick={skipCard}>Skip this card →</button><button type="button" onClick={() => startStudy(selectedDeck, false, true)}>Shuffle deck</button></div>
              <p className="flashcards-keyboard-hint">Use active recall first. Reveal only after you have formed an answer.</p>
            </div>
          ) : <div className="flashcards-empty-state"><h2>This deck has no cards yet.</h2><p>Add questions and answers, then start reviewing.</p><button type="button" className="flashcards-primary-button" onClick={() => setView("manage")}>Add cards</button></div>
        )}

        {view === "manage" && (
          <div className="flashcards-manage-layout">
            <div className="flashcards-manage-heading"><div><h2>Deck cards</h2><p>Add, edit or remove the questions in this deck.</p></div><span>{selectedDeck.cards.length} total</span></div>
            <form id="flashcard-editor" className="flashcards-editor" onSubmit={event => { event.preventDefault(); saveCard(); }}>
              <div className="flashcards-editor-title"><strong>{editorId ? "Edit flashcard" : "Add a flashcard"}</strong><span>{editorId ? "UPDATE CARD" : "NEW CARD"}</span></div>
              <label>Question / front<textarea value={frontDraft} onChange={event => setFrontDraft(event.target.value)} maxLength={1800} rows={2} placeholder="Ask one focused question. For example: What is the first-line treatment of…?" required/></label>
              <label>Answer / back<textarea value={backDraft} onChange={event => setBackDraft(event.target.value)} maxLength={2400} rows={3} placeholder="Write the concise answer, key distinction or clinical pearl." required/></label>
              <div className="flashcards-editor-actions"><button type="submit" className="flashcards-primary-button">{editorId ? "Save changes" : "Add card"} <span>→</span></button>{editorId && <button type="button" className="flashcards-text-button" onClick={() => { setEditorId(""); setFrontDraft(""); setBackDraft(""); }}>Cancel edit</button>}</div>
            </form>
            <div className="flashcards-card-list">
              {selectedDeck.cards.length ? selectedDeck.cards.map((card, index) => (
                <article className="flashcards-managed-card" key={card.id}>
                  <div className="flashcards-managed-top"><span>CARD {String(index + 1).padStart(2, "0")}</span><span className={"flashcards-status is-" + card.status}>{card.status === "known" ? "Known" : card.status === "review" ? "Review again" : "New"}</span></div>
                  <strong>{card.front}</strong><p>{card.back}</p>
                  <div className="flashcards-managed-actions"><button type="button" onClick={() => editCard(card)}>Edit</button><button type="button" onClick={() => deleteCard(card.id)}>Delete</button></div>
                </article>
              )) : <div className="flashcards-empty-state"><h3>Your first card starts here.</h3><p>Keep each card focused on one clinical fact, distinction or decision.</p></div>}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="flashcards-panel">
      <header className="flashcards-page-heading flashcards-overview-heading">
        <div><span className="flashcards-eyebrow">ACTIVE RECALL & SPACED REVISION</span><h1>Flashcards</h1><p>Turn important clinical knowledge into short recall sessions. Read the prompt, retrieve the answer, then rate your recall honestly.</p></div>
        <button type="button" className="flashcards-primary-button" onClick={() => { setShowCreate(value => !value); setNotice(""); }}>{showCreate ? "Close" : "+ Create a deck"}</button>
      </header>
      {notice && <p className="flashcards-notice" role="status">{notice}</p>}

      <section className="flashcards-source-builder" aria-labelledby="flashcards-source-title">
        <div className="flashcards-source-copy">
          <span className="flashcards-eyebrow">START WITH YOUR LECTURE</span>
          <h2 id="flashcards-source-title">Generate from my materials</h2>
          <p>Choose a lecture you have uploaded. ClerkME builds a revision deck from its generated study guide, including recall questions, viva prompts and key terms.</p>
          <div className="flashcards-source-steps"><span><b>01</b> Choose a lecture</span><span><b>02</b> Preview cards</span><span><b>03</b> Save and revise</span></div>
        </div>
        <div className="flashcards-source-controls">
          <label htmlFor="flashcards-source-select">Uploaded material</label>
          <select id="flashcards-source-select" value={sourceMaterialId} onChange={event => {setSourceMaterialId(event.target.value);setSourceCards([]);setSourceError("");}}>
            <option value="">Select a lecture or document</option>
            {sourceMaterials.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <button type="button" className="flashcards-primary-button" onClick={generateFromUploadedMaterial} disabled={sourceGenerating || !sourceMaterialId}>{sourceGenerating ? "Preparing your cards…" : "Generate flashcards"} <span>→</span></button>
          {!sourceMaterials.length && <small>Upload a lecture first in My materials.</small>}
          {sourceError && <p className="flashcards-source-error" role="alert">{sourceError}</p>}
        </div>
        {sourceCards.length > 0 && <div className="flashcards-source-preview">
          <div className="flashcards-source-preview-heading"><div><strong>{sourceCards.length} cards ready to review</strong><small>{sourceTitle} · Source-linked preview</small></div><button type="button" className="flashcards-text-button" onClick={() => setSourceCards([])}>Discard</button></div>
          <div className="flashcards-source-preview-list">{sourceCards.slice(0,5).map((item,index) => <article key={index}><span>QUESTION {String(index+1).padStart(2,"0")} · {item.source}</span><strong>{item.front}</strong><p>{item.back}</p></article>)}</div>
          {sourceCards.length > 5 && <small className="flashcards-source-more">Showing the first 5 of {sourceCards.length} cards. All cards will be saved.</small>}
          <button type="button" className="flashcards-primary-button" onClick={saveSourceDeck}>Save {sourceCards.length} flashcards to my library <span>→</span></button>
        </div>}
      </section>
      <div className="flashcards-stat-grid" aria-label="Flashcard library statistics">
        <div><span>YOUR DECKS</span><strong>{decks.length}</strong></div><div><span>TOTAL CARDS</span><strong>{totalCards}</strong></div><div><span>MASTERED</span><strong>{masteredCards}</strong></div><div><span>FLAGGED FOR REVIEW</span><strong>{reviewCards}</strong></div>
      </div>
      {showCreate && (
        <form className="flashcards-create-form" onSubmit={event => { event.preventDefault(); createDeck(); }}>
          <div className="flashcards-create-heading"><div><span className="flashcards-eyebrow">BUILD YOUR REVISION SET</span><h2>Create a deck</h2><p>Name it by topic, lecture or clinical unit.</p></div><span className="flashcards-create-symbol">＋</span></div>
          <div className="flashcards-create-fields"><label>Deck name<input value={deckTitle} onChange={event => setDeckTitle(event.target.value)} maxLength={90} placeholder="e.g. Hypertensive disorders in pregnancy" required/></label><label>Clinical unit<select value={deckUnit} onChange={event => setDeckUnit(event.target.value)}>{clinicalUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label></div>
          <label className="flashcards-bulk-label">Add questions now <span>OPTIONAL · ONE CARD PER LINE</span><textarea value={bulkCards} onChange={event => setBulkCards(event.target.value)} rows={4} placeholder={"What is the diagnostic threshold for…? | Write the threshold and relevant qualifier.\nWhich finding distinguishes…? | State the key differentiating feature."}/></label>
          <p className="flashcards-format-note">Separate the question and answer with a vertical bar ( | ). You can add or edit cards after creating the deck. Up to 60 cards can be added here.</p>
          <div className="flashcards-create-actions"><button type="submit" className="flashcards-primary-button">Create deck <span>→</span></button><button type="button" className="flashcards-text-button" onClick={() => setShowCreate(false)}>Cancel</button></div>
        </form>
      )}
      <div className="flashcards-library-heading"><div><h2>Your revision decks</h2><p>Pick up a deck or create a focused set from your current study guide.</p></div><label className="flashcards-search"><span aria-hidden="true">⌕</span><input value={deckSearch} onChange={event => setDeckSearch(event.target.value)} placeholder="Search decks…" aria-label="Search flashcard decks"/></label></div>
      {visibleDecks.length ? (
        <div className="flashcards-deck-grid">
          {visibleDecks.map(deck => {
            const due = deck.cards.filter(card => card.status === "review").length;
            const known = deck.cards.filter(card => card.status === "known").length;
            const progress = deck.cards.length ? Math.round((known / deck.cards.length) * 100) : 0;
            return <article className="flashcards-deck-card" key={deck.id}>
              <div className="flashcards-deck-card-top"><span className="flashcards-deck-icon" aria-hidden="true">▤</span><span className="flashcards-deck-unit">{unitLabel(deck.unit)}</span></div>
              <h3>{deck.title}</h3><div className="flashcards-deck-metrics"><span><strong>{deck.cards.length}</strong> cards</span><span><strong>{due}</strong> to review</span></div>
              <div className="flashcards-deck-progress"><span style={{ width: progress + "%" }}/></div><div className="flashcards-deck-progress-label"><span>{known} mastered</span><span>{progress}%</span></div>
              <div className="flashcards-deck-actions"><button type="button" className="flashcards-primary-button" onClick={() => openDeck(deck, deck.cards.length ? "study" : "manage")}>{deck.cards.length ? "Study deck" : "Add cards"} <span>→</span></button><button type="button" className="flashcards-icon-button" onClick={() => openDeck(deck, "manage")} aria-label={"Manage " + deck.title}>•••</button></div>
              {due > 0 && <button type="button" className="flashcards-review-link" onClick={() => startStudy(deck, true)}>Review {due} flagged card{due === 1 ? "" : "s"} →</button>}
              <button type="button" className="flashcards-delete-deck" onClick={() => deleteDeck(deck)}>Delete deck</button>
            </article>;
          })}
        </div>
      ) : (
        <div className="flashcards-empty-library">
          <div className="flashcards-empty-illustration" aria-hidden="true"><span>Q</span><i>A</i><b>✦</b></div>
          <span className="flashcards-eyebrow">{decks.length ? "NO MATCHES" : "START WITH ACTIVE RECALL"}</span>
          <h2>{decks.length ? "No decks match that search." : "Build your first revision deck."}</h2>
          <p>{decks.length ? "Try another topic or unit name." : "Create a deck for a lecture, disease or clinical topic. You can also turn questions and key terms from a ClerkME study guide into flashcards in one step."}</p>
          {!decks.length && <button type="button" className="flashcards-primary-button" onClick={() => setShowCreate(true)}>Create your first deck <span>→</span></button>}
        </div>
      )}
      <p className="flashcards-storage-note"><span>✓</span> Saved in this browser on this device. Cross-device sync is not enabled yet.</p>
    </section>
  );
}
