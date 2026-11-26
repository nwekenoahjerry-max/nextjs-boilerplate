"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clinicalUnits } from "../lib/learning-content";
import { extractStudyFile, STUDY_FILE_ACCEPT, STUDY_FILE_TYPES } from "../lib/file-text";
import SourceFileViewer from "./source-file-viewer";
import StudyGuideReadAloud from "./study-guide-read-aloud";
import { normaliseStudyStringsDeep } from "../lib/study-text";

type StudyVisualAid = {
  title:string;
  caption:string;
  altText:string;
  sourceSection:string;
  searchQuery?:string;
  visualPrompt?:string;
  imageUrl?:string;
  sourceUrl?:string;
  sourceName?:string;
  creator?:string;
  creatorUrl?:string;
  license?:string;
  licenseUrl?:string;
};
type GeneratedStudyIllustration = StudyVisualAid & { imageUrl:string; };
type SummarySection = {
  heading: string;
  summary: string;
  subsections?: Array<{heading:string;explanation:string;keyPoints?:string[];mentalModel?:string;memoryHook?:string;recallQuestion?:string;recallAnswer?:string}>;
  diagnosisPattern?: {
    patternSummary?:string;
    typicalPresentation?:string;
    historyClues?:string[];
    examinationClues?:string[];
    redFlags?:string[];
    diagnosticCriteria?:string[];
    investigations?:Array<{test:string;expectedFinding:string;interpretation:string}>;
    differentialDiagnoses?:Array<{diagnosis:string;distinguishingFeatures:string}>;
  } | null;
  managementPlan?:Array<{phase:string;intervention:string;rationale:string;monitoring?:string;cautions?:string}>;
  clinicalRelevance?: string;
  highYieldPoints?: string[];
  sourceLocator?: string;
};
type StudySummary = {
  overview: string;
  quickPreview?: boolean;
  generationMode?: "rapid" | "comprehensive";
  generationProvider?: "Gemini" | "Cloudflare Workers AI";
  visualAids?: StudyVisualAid[];
  visualAidsSearched?: boolean;
  highYieldPoints?: string[];
  learningObjectives?: string[];
  sections: SummarySection[];
  keyTerms?: Array<{term:string;meaning:string}>;
  comparisonTables?: Array<{title:string;columns:string[];rows:string[][]}>;
  mnemonics?: Array<{title:string;mnemonic:string;expansion:string[];whyItWorks?:string;caution?:string}>;
  memoryAids?: string[];
  commonPitfalls?: string[];
  revisionQuestions?: Array<{question:string;answer:string}>;
  unclearOrMissing?: string[];
  sourceCoverage?: string[];
  examFocus?: {
    mustKnow: string[];
    likelyShortNotes: string[];
    vivaQuestions: Array<{question:string;answer:string}>;
    clinicalApplications: string[];
  } | null;
  flowcharts?: Array<{title:string;steps:string[];takeaway?:string}>;
  videoSuggestions?: Array<{topic:string;whyWatch:string;channel:string}>;
  disclaimer?: string;
};
type MaterialQuestion = {
  question:string;
  options:string[];
  answerIndex:number;
  explanation:string;
  optionRationales?:string[];
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
  originalFileAvailable?:boolean;
  originalSizeBytes?:number|null;
  hasExtractableText?:boolean;
  summary:StudySummary|null;
  questions:MaterialQuestion[];
  hasSummary?:boolean;
  questionCount?:number;
  studyLoaded?:boolean;
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
type YouTubeVideo = {
  id:string;
  title:string;
  description:string;
  channelTitle:string;
  publishedAt:string;
  thumbnailUrl:string;
};

async function readResponse(response: Response) {
  const raw = await response.text();
  let data: Record<string, any> = {};
  try { data = raw ? JSON.parse(raw) as Record<string, any> : {}; }
  catch {
    const status = response.status ? " (" + response.status + ")" : "";
    throw new Error(response.ok
      ? "ClerkME received an unexpected response from its server. Please retry."
      : "ClerkME’s server could not complete the request" + status + ". Please retry.");
  }
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The request could not be completed (" + response.status + ").");
  return data;
}
function safeStudyError(message:string) {
  return message
    .replace(/\bGemini\b/gi,"study service")
    .replace(/\bZ\.ai\b/gi,"study service")
    .replace(/GEMINI_[A-Z0-9_]+/g,"study service")
    .trim();
}
function formatDate(timestamp:number) {
  if (!timestamp) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium"}).format(new Date(timestamp*1000));
}
function formatTimer(seconds:number) {
  const safe = Math.max(0,Math.floor(seconds));
  return String(Math.floor(safe/60)).padStart(2,"0")+":"+String(safe%60).padStart(2,"0");
}
const ACTIVE_LIVE_MATERIAL_KEY = "clerkme:live-test:active-material";
const liveSessionKey = (materialId:string) => "clerkme:live-test:"+materialId;
const illustrationSessionKey = (materialId:string) => "clerkme:illustrations:"+materialId;
type LibraryMode = "clinical" | "general";
const CUSTOM_SUBJECT_PREFIX = "custom:";
const isCustomSubjectUnit = (value:string) => value.startsWith(CUSTOM_SUBJECT_PREFIX);
const customSubjectLabel = (value:string) => isCustomSubjectUnit(value) ? value.slice(CUSTOM_SUBJECT_PREFIX.length) : value;
const makeCustomSubjectUnit = (value:string) => CUSTOM_SUBJECT_PREFIX + value.trim();


function visualMatchesHeading(sourceSection:string, heading:string):boolean {
  const normalise=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  const source=normalise(sourceSection),target=normalise(heading);
  if(!source||!target)return false;
  if(source===target||source.includes(target)||target.includes(source))return true;
  const left=new Set(source.split(" ").filter(word=>word.length>2));
  const right=target.split(" ").filter(word=>word.length>2);
  const shared=right.filter(word=>left.has(word)).length;
  return shared>=2&&shared/Math.min(left.size,right.length)>=0.75;
}

function InlineStudyVisual({visual}:{visual:GeneratedStudyIllustration}) {
  return <figure className="study-inline-visual-card">
    <img src={visual.imageUrl} alt={visual.altText||visual.title} loading="lazy" decoding="async"/>
    <figcaption>
      <strong>{visual.title}</strong>
      <p>{visual.caption}</p>
      <div className="study-inline-visual-credit">
        {visual.creator&&<span>By {visual.creator}</span>}
        {visual.sourceName&&<span>Image source: {visual.sourceName}</span>}
        {visual.license&&visual.licenseUrl&&<a href={visual.licenseUrl} target="_blank" rel="noopener noreferrer">{visual.license}</a>}
        {visual.license&&!visual.licenseUrl&&<span>{visual.license}</span>}
        {visual.sourceUrl&&<a href={visual.sourceUrl} target="_blank" rel="noopener noreferrer">View original image</a>}
      </div>
    </figcaption>
  </figure>;
}

export default function MaterialsPanel({userKey}:{userKey:string}) {
  const [materials,setMaterials] = useState<StudyMaterial[]>([]);
  const pendingResumeScrollRef = useRef<number|null>(null);
  const [sourceTextByMaterial,setSourceTextByMaterial] = useState<Record<string,string>>({});
  const [unit,setUnit] = useState("general-medicine");
  const [libraryUnit,setLibraryUnit] = useState("select");
  const [libraryMode,setLibraryMode] = useState<LibraryMode>("clinical");
  const [customSubject,setCustomSubject] = useState("");
  const [libraryModeReady,setLibraryModeReady] = useState(false);
  const [category,setCategory] = useState("Lecture notes");
  const [title,setTitle] = useState("");
  const [file,setFile] = useState<File|null>(null);
  const [selectedId,setSelectedId] = useState("");
  const [mobileDetailOpen,setMobileDetailOpen] = useState(false);
  const [showUploadForm,setShowUploadForm] = useState(false);
  const [librarySearch,setLibrarySearch] = useState("");
  const [expandedUnits,setExpandedUnits] = useState<Record<string,boolean>>({});
  const [uploading,setUploading] = useState(false);
  const [summaryWorking,setSummaryWorking] = useState(false);
  const [studyGuideMode,setStudyGuideMode] = useState<"rapid"|"comprehensive">("comprehensive");
  const [questionsWorking,setQuestionsWorking] = useState(false);
  const working = summaryWorking || questionsWorking;
  const [questionGenerationStatus,setQuestionGenerationStatus] = useState<Record<string,"generating"|"ready"|"failed">>({});
  const [questionGenerationErrors,setQuestionGenerationErrors] = useState<Record<string,string>>({});
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [tab,setTab] = useState<"summary"|"source"|"questions"|"ask">("summary");
  const [questionIndex,setQuestionIndex] = useState(0);
  const [questionAnswers,setQuestionAnswers] = useState<Record<number,number>>({});
  const [quizFinished,setQuizFinished] = useState(false);
  const [quizMode,setQuizMode] = useState<"practice"|"live">("practice");
  const [durationChoice,setDurationChoice] = useState("20");
  const [customDuration,setCustomDuration] = useState("30");
  const [liveDeadline,setLiveDeadline] = useState<number|null>(null);
  const [liveStartedAt,setLiveStartedAt] = useState<number|null>(null);
  const [liveDurationSeconds,setLiveDurationSeconds] = useState(20*60);
  const [remainingSeconds,setRemainingSeconds] = useState(20*60);
  const [liveElapsedSeconds,setLiveElapsedSeconds] = useState(0);
  const [liveTimedOut,setLiveTimedOut] = useState(false);
  const [sessionHydratedFor,setSessionHydratedFor] = useState("");
  const [question,setQuestion] = useState("");
  const [answer,setAnswer] = useState<TutorAnswer|null>(null);
  const [answering,setAnswering] = useState(false);
  const [questionCount,setQuestionCount] = useState(10);
  const [questionDifficulty,setQuestionDifficulty] = useState("Mixed");
  const [illustrationsByMaterial,setIllustrationsByMaterial] = useState<Record<string,GeneratedStudyIllustration[]>>({});
  const [illustratingMaterialId,setIllustratingMaterialId] = useState("");
  const [illustrationErrors,setIllustrationErrors] = useState<Record<string,string>>({});
  const illustrationAttemptsRef = useRef<Set<string>>(new Set());
  const [expandedStudySections,setExpandedStudySections] = useState<number[]>([]);
  const [youtubeQuery,setYoutubeQuery] = useState("");
  const [youtubeVideos,setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [youtubeLoading,setYoutubeLoading] = useState(false);
  const [youtubeError,setYoutubeError] = useState("");
  const [activeYoutubeVideo,setActiveYoutubeVideo] = useState<YouTubeVideo|null>(null);
  const youtubePlayerRef = useRef<HTMLDivElement>(null);
  const [youtubeLink,setYoutubeLink] = useState("");
  const [videoSaving,setVideoSaving] = useState(false);
  const [savedYoutubeVideoIds,setSavedYoutubeVideoIds] = useState<string[]>([]);
  const [videoSaveNotice,setVideoSaveNotice] = useState("");
  const [videoSaveError,setVideoSaveError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("clerkme-library-mode");
      if (saved === "general" || saved === "clinical") setLibraryMode(saved);
    } catch {}
    setLibraryModeReady(true);
  }, []);
  useEffect(() => {
    if (!libraryModeReady) return;
    try { window.localStorage.setItem("clerkme-library-mode",libraryMode); } catch {}
  },[libraryMode,libraryModeReady]);

  useEffect(() => {
    if (!activeYoutubeVideo) return;
    const frame = window.requestAnimationFrame(() => {
      youtubePlayerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeYoutubeVideo?.id]);

  const unitName = (id:string)=>isCustomSubjectUnit(id)
    ? customSubjectLabel(id)
    : clinicalUnits.find(item=>item.id===id)?.name || id;
  const modeMaterials = useMemo(
    ()=>materials.filter(item=>libraryMode==="general"?isCustomSubjectUnit(item.unit):!isCustomSubjectUnit(item.unit)),
    [materials,libraryMode]
  );
  const unitFilteredMaterials = useMemo(
    ()=>libraryUnit==="all"
      ? modeMaterials
      : libraryUnit==="select"
        ? []
        : modeMaterials.filter(item=>item.unit===libraryUnit),
    [modeMaterials,libraryUnit]
  );
  const visibleMaterials = useMemo(()=>{
    const query=librarySearch.trim().toLocaleLowerCase();
    return query?unitFilteredMaterials.filter(item=>[item.title,item.sourceName,item.category,unitName(item.unit)].some(value=>value.toLocaleLowerCase().includes(query))):unitFilteredMaterials;
  },[unitFilteredMaterials,librarySearch]);
  const libraryBrowseUnits = useMemo(()=>{
    if(libraryMode==="clinical") return clinicalUnits.map(item=>({id:item.id,name:item.name}));
    return [...new Set(modeMaterials.map(item=>item.unit))]
      .sort((a,b)=>unitName(a).localeCompare(unitName(b),"en",{sensitivity:"base"}))
      .map(id=>({id,name:unitName(id)}));
  },[libraryMode,modeMaterials]);
  const groupedVisibleMaterials = useMemo(()=>{
    const orderedIds = libraryMode==="clinical"
      ? clinicalUnits.map(item=>item.id).filter(id=>visibleMaterials.some(material=>material.unit===id))
      : [...new Set(visibleMaterials.map(item=>item.unit))].sort((a,b)=>unitName(a).localeCompare(unitName(b),"en"));
    return orderedIds
      .map(id=>({id,name:unitName(id),materials:visibleMaterials.filter(item=>item.unit===id)}))
      .filter(group=>group.materials.length>0);
  },[visibleMaterials,libraryMode]);
  const selectedMaterial = useMemo(()=>materials.find(item=>item.id===selectedId)||null,[materials,selectedId]);

  const flashcardCandidates = useMemo(() => {
    const summary = selectedMaterial?.summary;
    if (!summary) return [];
    const candidates = [
      ...(summary.revisionQuestions || []).map(item => ({ front: item.question, back: item.answer })),
      ...(summary.examFocus?.vivaQuestions || []).map(item => ({ front: item.question, back: item.answer })),
      ...(summary.sections || []).flatMap(section => (section.subsections || [])
        .filter(item => item.recallQuestion && item.recallAnswer)
        .map(item => ({ front: item.recallQuestion || "", back: item.recallAnswer || "" }))),
      ...(summary.keyTerms || []).map(item => ({ front: "Define " + item.term, back: item.meaning })),
    ];
    const seen = new Set<string>();
    return candidates.filter(item => {
      const front = (item.front || "").trim();
      const back = (item.back || "").trim();
      const key = (front + "|" + back).toLowerCase();
      if (!front || !back || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 60);
  }, [selectedMaterial]);

  const selectedMaterialIsGeneral = !!selectedMaterial && isCustomSubjectUnit(selectedMaterial.unit);
  const selectedVisuals = useMemo<GeneratedStudyIllustration[]>(()=>{
    if (!selectedMaterial) return [];
    const current = illustrationsByMaterial[selectedMaterial.id] || [];
    if (current.length) return current;
    return (selectedMaterial.summary?.visualAids || []).filter((item):item is GeneratedStudyIllustration => typeof item.imageUrl === "string" && item.imageUrl.startsWith("https://"));
  },[selectedMaterial,illustrationsByMaterial]);
  const unplacedVisuals = useMemo(()=>{
    if (!selectedMaterial?.summary) return [];
    const headings = (selectedMaterial.summary.sections || []).flatMap(section=>[section.heading,...(section.subsections||[]).map(item=>item.heading)]);
    return selectedVisuals.filter(visual=>!headings.some(heading=>visualMatchesHeading(visual.sourceSection,heading)));
  },[selectedMaterial,selectedVisuals]);
  const selectLibraryMode = (nextMode:LibraryMode) => {
    setLibraryMode(nextMode);
    setLibraryUnit("select");
    setLibrarySearch("");
    setExpandedUnits({});
    setSelectedId("");
    setMobileDetailOpen(false);
    setShowUploadForm(false);
    if(nextMode==="general"){
      const firstSubject=materials.find(item=>isCustomSubjectUnit(item.unit));
      setCustomSubject(firstSubject?unitName(firstSubject.unit):"");
    } else {
      setUnit("general-medicine");
    }
    setAnswer(null); setTab("summary"); setQuestionIndex(0); setQuestionAnswers({}); setQuizFinished(false); setQuizMode("practice"); setLiveDeadline(null); setLiveStartedAt(null); setLiveElapsedSeconds(0); setLiveTimedOut(false); setError("");
  };
  const selectLibraryUnit = (nextUnit:string) => {
    setLibraryUnit(nextUnit);
    setUnit(nextUnit==="all"||nextUnit==="select"?"general-medicine":nextUnit);
    if(libraryMode==="general" && nextUnit!=="all" && nextUnit!=="select") setCustomSubject(unitName(nextUnit));
    setLibrarySearch("");
    setExpandedUnits({});
    setMobileDetailOpen(false);
    setSelectedId("");
    setAnswer(null); setTab("summary"); setQuestionIndex(0); setQuestionAnswers({}); setQuizFinished(false); setQuizMode("practice"); setLiveDeadline(null); setLiveStartedAt(null); setLiveElapsedSeconds(0); setLiveTimedOut(false); setError("");
  };
  const openMaterial = (item:StudyMaterial) => {
    setSelectedId(item.id);
    setAnswer(null);
    setTab("summary");
    setQuestionIndex(0);
    setQuestionAnswers({});
    setQuizFinished(false);
    setQuizMode("practice");
    setLiveDeadline(null);
    setLiveStartedAt(null);
    setLiveElapsedSeconds(0);
    setLiveTimedOut(false);
    setError("");
    setShowUploadForm(false);
    setMobileDetailOpen(true);
    window.requestAnimationFrame(()=>document.getElementById("materials-detail-card")?.scrollIntoView({behavior:"smooth",block:"start"}));
  };
  const openUploadForm = () => {
    setSelectedId("");
    setMobileDetailOpen(false);
    setShowUploadForm(true);
    setMobileDetailOpen(false);
    setError("");
    setNotice("");
    window.requestAnimationFrame(()=>document.getElementById("materials-upload-card")?.scrollIntoView({behavior:"smooth",block:"start"}));
  };
  const closeUploadForm = () => {
    setShowUploadForm(false);
    setFile(null);
    setTitle("");
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const returnToLibrary = () => {
    if (liveInProgress) return;
    setMobileDetailOpen(false);
    setSelectedId("");
    setAnswer(null);
    setQuestionIndex(0);
    setQuestionAnswers({});
    setQuizFinished(false);
    setQuizMode("practice");
    setLiveDeadline(null);
    setLiveStartedAt(null);
    setLiveElapsedSeconds(0);
    setLiveTimedOut(false);
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const activeQuestions = selectedMaterial?.questions || [];
  const activeQuestionCount = activeQuestions.length;
  const answeredCount = Object.keys(questionAnswers).length;
  const correctCount = activeQuestions.reduce((total,item,index)=>total+(questionAnswers[index]===item.answerIndex?1:0),0);
  const currentQuestion = activeQuestions[questionIndex] || null;
  const currentAnswer = questionAnswers[questionIndex] ?? null;
  const scorePercent = activeQuestions.length ? Math.round(correctCount/activeQuestions.length*100) : 0;
  const requestedMinutes = durationChoice==="custom" ? Number(customDuration) : Number(durationChoice);
  const liveDurationMinutes = Number.isFinite(requestedMinutes) ? Math.max(5,Math.min(180,Math.round(requestedMinutes))) : 20;
  const liveInProgress = quizMode==="live" && liveDeadline!==null && !quizFinished;
  const timerUrgency = remainingSeconds<=60 ? "urgent" : remainingSeconds<=300 ? "warning" : "";
  const studySectionCount = selectedMaterial?.summary?.sections?.length || 0;
  const allStudySectionsExpanded = studySectionCount>0 && Array.from({length:studySectionCount},(_,index)=>index).every(index=>expandedStudySections.includes(index));
  const toggleStudySection = (index:number) => setExpandedStudySections(current=>current.includes(index)?current.filter(item=>item!==index):[...current,index]);
  const toggleAllStudySections = () => setExpandedStudySections(allStudySectionsExpanded?[]:Array.from({length:studySectionCount},(_,index)=>index));
  const topHighYieldPoints = selectedMaterial?.summary?.highYieldPoints?.length
    ? selectedMaterial.summary.highYieldPoints
    : selectedMaterial?.summary?.examFocus?.mustKnow || [];
  const recommendedVideoSuggestions = useMemo(() => {
    const saved = selectedMaterial?.summary?.videoSuggestions || [];
    if (saved.length) return saved.slice(0,2);
    if (!selectedMaterial) return [];
    return [{
      topic: selectedMaterial.title,
      whyWatch: "Watch a focused overview of this lecture topic to reinforce the key concepts.",
      channel: "Osmosis"
    }];
  }, [selectedMaterial]);

  const searchYouTube = async (query:string, playFirstResult=false) => {
    const cleanQuery=query.trim();
    if(!cleanQuery) return;
    setYoutubeQuery(cleanQuery);
    setYoutubeLoading(true);
    setYoutubeError("");
    setYoutubeVideos([]);
    setActiveYoutubeVideo(null);
    try {
      const response=await fetch("/api/learning/videos",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({query:cleanQuery})
      });
      const data=await readResponse(response);
      const videos=Array.isArray(data.videos)?data.videos as YouTubeVideo[]:[];
      setYoutubeVideos(videos);
      if(playFirstResult && videos[0]) {
        setActiveYoutubeVideo(videos[0]);
        setYoutubeError("");
      } else if(!videos.length) {
        setYoutubeError("No embeddable videos were found for this topic. Try another recommended topic or paste a video link.");
      }
    } catch(e) {
      setYoutubeError(e instanceof Error?e.message:"Video search is temporarily unavailable. Paste a video link to play it here.");
    } finally { setYoutubeLoading(false); }
  };

  const saveActiveYoutubeVideo = async () => {
    if (!activeYoutubeVideo || !selectedMaterial) return;
    setVideoSaving(true);
    setVideoSaveNotice("");
    setVideoSaveError("");
    try {
      const response = await fetch("/api/learning/saved-videos", {
        method:"POST", headers:{"Content-Type":"application/json"}, credentials:"same-origin",
        body:JSON.stringify({
          videoId:activeYoutubeVideo.id,
          title:activeYoutubeVideo.title,
          description:activeYoutubeVideo.description,
          channelTitle:activeYoutubeVideo.channelTitle,
          thumbnailUrl:activeYoutubeVideo.thumbnailUrl,
          folder:unitName(selectedMaterial.unit)
        })
      });
      await readResponse(response);
      setSavedYoutubeVideoIds(current=>current.includes(activeYoutubeVideo.id)?current:[...current,activeYoutubeVideo.id]);
      setVideoSaveNotice("Saved to "+unitName(selectedMaterial.unit)+" in your video library.");
    } catch(e) {
      setVideoSaveError(e instanceof Error?e.message:"Could not save this lecture.");
    } finally { setVideoSaving(false); }
  };

  const parseYouTubeVideoId = (value:string):string|null => {
    const input=value.trim();
    if(/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
    try {
      const url=new URL(input);
      const host=url.hostname.toLowerCase().replace(/^www\./,"");
      let id="";
      if(host==="youtu.be") id=url.pathname.split("/").filter(Boolean)[0]||"";
      else if(["youtube.com","m.youtube.com","music.youtube.com","youtube-nocookie.com"].includes(host)) {
        if(url.pathname==="/watch") id=url.searchParams.get("v")||"";
        else id=url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)?.[1]||"";
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
    } catch { return null; }
  };

  const playYouTubeLink = () => {
    const id=parseYouTubeVideoId(youtubeLink);
    if(!id) { setYoutubeError("That does not look like a valid YouTube video link. Use a youtube.com/watch, youtu.be, /shorts or /embed link."); return; }
    setActiveYoutubeVideo({
      id,title:"Selected lecture",description:"Playing a video link supplied by you.",
      channelTitle:"YouTube",publishedAt:"",thumbnailUrl:"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg"
    });
    setYoutubeVideos([]);
    setYoutubeError("");
  };

  const loadMaterials = async () => {
    const response = await fetch("/api/learning/materials",{credentials:"same-origin",cache:"no-store"});
    const data = await readResponse(response);
    const cached = new Map(materials.map(item=>[item.id,item]));
    const next = (Array.isArray(data.materials) ? data.materials as StudyMaterial[] : []).map(item=>{
      const existing = cached.get(item.id);
      const cleanedItem = normaliseStudyStringsDeep(item) as StudyMaterial;
      return existing?.studyLoaded ? {
        ...cleanedItem,
        summary: existing.summary ? normaliseStudyStringsDeep(existing.summary) as StudySummary : null,
        questions: existing.questions || [],
        hasSummary: existing.hasSummary,
        questionCount: existing.questionCount,
        studyLoaded: true
      } : cleanedItem;
    });
    setMaterials(next);

    // Restore this learner's last opened material and study area on this device.
    // The material is matched against the authenticated library response before opening.
    if (userKey) {
      try {
        const rawResume = window.localStorage.getItem("clerkme:last-study:" + userKey);
        if (rawResume) {
          const resume = JSON.parse(rawResume) as Record<string, unknown>;
          const validTab = ["summary","source","questions","ask"].includes(String(resume.tab))
            ? String(resume.tab) as "summary"|"source"|"questions"|"ask"
            : "summary";
          const savedMaterial = typeof resume.materialId === "string"
            ? next.find(item => item.id === resume.materialId)
            : undefined;
          if (savedMaterial) {
            const savedScrollY = Number(resume.scrollY);
            pendingResumeScrollRef.current = Number.isFinite(savedScrollY) && savedScrollY >= 0 ? savedScrollY : 0;
            setLibraryMode(savedMaterial.unit.startsWith("custom:") ? "general" : "clinical");
            setLibraryUnit("all");
            setSelectedId(savedMaterial.id);
            setTab(validTab);
            if (Number.isInteger(resume.questionIndex) && Number(resume.questionIndex) >= 0) {
              const savedQuestionCount = Number(savedMaterial.questionCount) || 0;
              setQuestionIndex(Math.min(Math.max(0, savedQuestionCount - 1), Number(resume.questionIndex)));
            }
            setMobileDetailOpen(true);
          } else if (typeof resume.materialId === "string") {
            window.localStorage.removeItem("clerkme:last-study:" + userKey);
            window.dispatchEvent(new CustomEvent("clerkme:study-progress", {detail:{cleared:true}}));
          }
        }
      } catch {}
    }

    // Refreshes preserve an explicitly opened material.
    if (selectedId && !next.some(item=>item.id===selectedId)) {
      setSelectedId("");
      setMobileDetailOpen(false);
    }
    return next;
  };

  const loadMaterialStudy = async (materialId:string) => {
    const response = await fetch("/api/learning/materials?id="+encodeURIComponent(materialId)+"&include=study",
      {credentials:"same-origin",cache:"no-store"});
    const data = await readResponse(response);
    const study = normaliseStudyStringsDeep((data.material || {}) as Partial<StudyMaterial>);
    setMaterials(current=>current.map(item=>item.id===materialId ? {
      ...item,
      summary: study.summary || null,
      questions: Array.isArray(study.questions) ? study.questions as MaterialQuestion[] : [],
      hasSummary: Boolean(study.hasSummary),
      questionCount: Number(study.questionCount) || 0,
      studyLoaded: true
    } : item));
    return study;
  };

  useEffect(() => {
    if (!userKey || !selectedId) return;
    const current = materials.find(item => item.id === selectedId);
    if (!current) return;
    const progress = {
      materialId: current.id,
      title: current.title,
      unit: current.unit,
      tab,
      lastOpenedAt: Date.now(),
      scrollY: pendingResumeScrollRef.current ?? window.scrollY,
      questionIndex
    };
    try { window.localStorage.setItem("clerkme:last-study:" + userKey, JSON.stringify(progress)); } catch {}
    window.dispatchEvent(new CustomEvent("clerkme:study-progress", { detail: progress }));
  }, [userKey, selectedId, tab, materials, questionIndex]);

  // Keep the last reading position without writing to storage on every scroll event.
  useEffect(() => {
    if (!userKey || !selectedId) return;
    let lastSavedAt = 0;
    const saveScrollPosition = () => {
      const now = Date.now();
      if (now - lastSavedAt < 1200) return;
      lastSavedAt = now;
      try {
        const key = "clerkme:last-study:" + userKey;
        const raw = window.localStorage.getItem(key);
        if (!raw) return;
        const progress = JSON.parse(raw) as Record<string, unknown>;
        if (progress.materialId !== selectedId) return;
        progress.scrollY = window.scrollY;
        progress.lastOpenedAt = now;
        window.localStorage.setItem(key, JSON.stringify(progress));
      } catch {}
    };
    window.addEventListener("scroll", saveScrollPosition, {passive:true});
    window.addEventListener("pagehide", saveScrollPosition);
    return () => {
      window.removeEventListener("scroll", saveScrollPosition);
      window.removeEventListener("pagehide", saveScrollPosition);
    };
  }, [userKey, selectedId]);

  useEffect(() => {
    if (!selectedId || !mobileDetailOpen || pendingResumeScrollRef.current === null) return;
    const material = materials.find(item => item.id === selectedId);
    if (!material?.studyLoaded) return;
    const savedY = pendingResumeScrollRef.current;
    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({top:savedY,behavior:"instant"});
        pendingResumeScrollRef.current = null;
      });
    });
    return () => window.cancelAnimationFrame(firstFrame);
  }, [selectedId, tab, mobileDetailOpen, materials]);

  useEffect(()=>{ loadMaterials().catch(e=>setError(e instanceof Error?e.message:"Could not load your study materials.")); },[]);
  useEffect(()=>{
    if (!selectedId || materials.find(item=>item.id===selectedId)?.studyLoaded) return;
    let cancelled = false;
    fetch("/api/learning/materials?id="+encodeURIComponent(selectedId)+"&include=study",
      {credentials:"same-origin",cache:"no-store"})
      .then(readResponse)
      .then(data=>{
        if (cancelled) return;
        const study = normaliseStudyStringsDeep((data.material || {}) as Partial<StudyMaterial>);
        setMaterials(current=>current.map(item=>item.id===selectedId ? {
          ...item,
          summary: study.summary || null,
          questions: Array.isArray(study.questions) ? study.questions as MaterialQuestion[] : [],
          hasSummary: Boolean(study.hasSummary),
          questionCount: Number(study.questionCount) || 0,
          studyLoaded: true
        } : item));
      })
      .catch(e=>{ if(!cancelled) setError(e instanceof Error?e.message:"Could not load the saved study guide and questions."); });
    return ()=>{cancelled=true;};
  },[selectedId]);
  useEffect(()=>{
    if (!selectedId) return;
    try {
      const raw = window.sessionStorage.getItem(illustrationSessionKey(selectedId));
      if (!raw) return;
      const cached = JSON.parse(raw) as unknown;
      if (Array.isArray(cached)) {
        const valid = cached.filter((item):item is GeneratedStudyIllustration =>
          !!item && typeof item === "object" && typeof (item as GeneratedStudyIllustration).imageUrl === "string" &&
          (item as GeneratedStudyIllustration).imageUrl.startsWith("https://")
        );
        if (valid.length) setIllustrationsByMaterial(current=>({...current,[selectedId]:valid}));
      }
    } catch {}
  },[selectedId]);
  useEffect(()=>{ setExpandedStudySections([0,1,2]); },[selectedId]);
  useEffect(()=>{ setYoutubeVideos([]); setActiveYoutubeVideo(null); setYoutubeError(""); setYoutubeQuery(""); setYoutubeLink(""); },[selectedId]);
  useEffect(()=>{
    if (tab!=="source" || !selectedId || sourceTextByMaterial[selectedId]) return;
    let cancelled = false;
    fetch("/api/learning/materials?id="+encodeURIComponent(selectedId),{credentials:"same-origin",cache:"no-store"})
      .then(readResponse)
      .then(data=>{ if(!cancelled && typeof data.material?.contentText==="string") setSourceTextByMaterial(current=>({...current,[selectedId]:data.material.contentText})); })
      .catch(e=>{ if(!cancelled) setError(e instanceof Error?e.message:"Could not load the uploaded source text."); });
    return ()=>{cancelled=true;};
  },[tab,selectedId,sourceTextByMaterial]);


  useEffect(()=>{
    if (!selectedId) return;
    let restored = false;
    try {
      const raw = window.sessionStorage.getItem(liveSessionKey(selectedId));
      if (raw) {
        const saved = JSON.parse(raw) as Record<string,unknown>;
        const deadline = Number(saved.deadline);
        const startedAt = Number(saved.startedAt);
        const durationSeconds = Number(saved.durationSeconds);
        if (Number.isFinite(deadline) && deadline>0 && Number.isFinite(startedAt) && startedAt>0 &&
            Number.isInteger(durationSeconds) && durationSeconds>=5*60 && durationSeconds<=180*60) {
          const savedIndex = Number(saved.questionIndex);
          const safeIndex = Number.isInteger(savedIndex) ? Math.max(0,Math.min(Math.max(0,activeQuestionCount-1),savedIndex)) : 0;
          const sourceAnswers = saved.answers && typeof saved.answers==="object" ? saved.answers as Record<string,unknown> : {};
          const safeAnswers:Record<number,number> = {};
          for (const [key,value] of Object.entries(sourceAnswers)) {
            const questionNumber = Number(key);
            if (Number.isInteger(questionNumber) && questionNumber>=0 && questionNumber<activeQuestionCount &&
                Number.isInteger(value) && Number(value)>=0 && Number(value)<4) {
              safeAnswers[questionNumber] = Number(value);
            }
          }
          setQuizMode("live");
          setQuestionIndex(safeIndex);
          setQuestionAnswers(safeAnswers);
          setQuizFinished(false);
          setLiveTimedOut(false);
          setLiveStartedAt(startedAt);
          setLiveDurationSeconds(durationSeconds);
          setLiveDeadline(deadline);
          setRemainingSeconds(Math.max(0,Math.ceil((deadline-Date.now())/1000)));
          setLiveElapsedSeconds(Math.min(durationSeconds,Math.max(0,Math.floor((Date.now()-startedAt)/1000))));
          setTab("questions");
          restored = true;
        } else {
          window.sessionStorage.removeItem(liveSessionKey(selectedId));
          if (window.sessionStorage.getItem(ACTIVE_LIVE_MATERIAL_KEY)===selectedId) window.sessionStorage.removeItem(ACTIVE_LIVE_MATERIAL_KEY);
        }
      }
    } catch {
      try {
        window.sessionStorage.removeItem(liveSessionKey(selectedId));
        if (window.sessionStorage.getItem(ACTIVE_LIVE_MATERIAL_KEY)===selectedId) window.sessionStorage.removeItem(ACTIVE_LIVE_MATERIAL_KEY);
      } catch {}
    }
    setSessionHydratedFor(selectedId);
    if (!restored) setQuizMode("practice");
  },[selectedId,activeQuestionCount]);

  useEffect(()=>{
    if (!selectedId || sessionHydratedFor!==selectedId) return;
    try {
      if (quizMode==="live" && liveDeadline!==null && liveStartedAt!==null && !quizFinished) {
        window.sessionStorage.setItem(ACTIVE_LIVE_MATERIAL_KEY,selectedId);
        window.sessionStorage.setItem(liveSessionKey(selectedId),JSON.stringify({
          deadline:liveDeadline,
          startedAt:liveStartedAt,
          durationSeconds:liveDurationSeconds,
          questionIndex,
          answers:questionAnswers
        }));
      } else {
        window.sessionStorage.removeItem(liveSessionKey(selectedId));
        if (window.sessionStorage.getItem(ACTIVE_LIVE_MATERIAL_KEY)===selectedId) window.sessionStorage.removeItem(ACTIVE_LIVE_MATERIAL_KEY);
      }
    } catch {}
  },[selectedId,sessionHydratedFor,quizMode,liveDeadline,liveStartedAt,liveDurationSeconds,questionIndex,questionAnswers,quizFinished]);

  useEffect(()=>{
    if (quizMode!=="live" || liveDeadline===null || quizFinished) return;
    const updateCountdown = () => {
      const secondsLeft = Math.max(0,Math.ceil((liveDeadline-Date.now())/1000));
      setRemainingSeconds(secondsLeft);
      if (secondsLeft===0) {
        setLiveTimedOut(true);
        setLiveElapsedSeconds(liveDurationSeconds);
        setQuizFinished(true);
        setLiveDeadline(null);
      }
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown,1000);
    return ()=>window.clearInterval(interval);
  },[quizMode,liveDeadline,liveStartedAt,liveDurationSeconds,quizFinished]);

  const switchQuizMode = (mode:"practice"|"live") => {
    if (liveInProgress) return;
    setQuizMode(mode);
    setQuestionIndex(0);
    setQuestionAnswers({});
    setQuizFinished(false);
    setLiveDeadline(null);
    setLiveStartedAt(null);
    setLiveElapsedSeconds(0);
    setLiveTimedOut(false);
    setRemainingSeconds(liveDurationMinutes*60);
  };

  const startLiveTest = () => {
    const seconds = liveDurationMinutes*60;
    const startedAt = Date.now();
    setQuizMode("live");
    setQuestionIndex(0);
    setQuestionAnswers({});
    setQuizFinished(false);
    setLiveTimedOut(false);
    setLiveElapsedSeconds(0);
    setLiveDurationSeconds(seconds);
    setRemainingSeconds(seconds);
    setLiveStartedAt(startedAt);
    setLiveDeadline(startedAt+seconds*1000);
  };

  const finishLiveTest = (timedOut=false) => {
    const elapsed = liveStartedAt===null ? 0 : Math.min(liveDurationSeconds,Math.max(0,Math.floor((Date.now()-liveStartedAt)/1000)));
    setLiveElapsedSeconds(elapsed);
    setLiveTimedOut(timedOut);
    setQuizFinished(true);
    setLiveDeadline(null);
    if (timedOut) setRemainingSeconds(0);
  };

  const generateIllustrations = async (materialId:string, force=false) => {
    if (!force && illustrationsByMaterial[materialId]?.length) return illustrationsByMaterial[materialId];
    if (illustratingMaterialId) return [];
    if (!force && illustrationAttemptsRef.current.has(materialId)) return [];
    illustrationAttemptsRef.current.add(materialId);
    setIllustratingMaterialId(materialId);
    setIllustrationErrors(current=>({...current,[materialId]:""}));
    try {
      const response = await fetch("/api/learning/illustrations",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({materialId,force})
      });
      const data = await readResponse(response);
      const found = Array.isArray(data.illustrations) ? data.illustrations as GeneratedStudyIllustration[] : [];
      const visualAids = Array.isArray(data.visualAids) ? data.visualAids as StudyVisualAid[] : [];
      setMaterials(current=>current.map(item=>item.id===materialId&&item.summary
        ? {...item,summary:{...item.summary,visualAids,visualAidsSearched:true}}
        : item));
      if (found.length) {
        setIllustrationsByMaterial(current=>({...current,[materialId]:found}));
        try { window.sessionStorage.setItem(illustrationSessionKey(materialId),JSON.stringify(found)); } catch {}
        setIllustrationErrors(current=>({...current,[materialId]:typeof data.warning==="string"&&data.warning?data.warning:""}));
      } else {
        setIllustrationsByMaterial(current=>({...current,[materialId]:[]}));
        try { window.sessionStorage.removeItem(illustrationSessionKey(materialId)); } catch {}
        setIllustrationErrors(current=>({...current,[materialId]:typeof data.message==="string"?data.message:"No relevant openly licensed images were found."}));
      }
      return found;
    } catch {
      setIllustrationErrors(current=>({...current,[materialId]:"Image search is temporarily unavailable. Your study guide remains available; please try again."}));
      return [];
    } finally {
      setIllustratingMaterialId("");
    }
  };

  useEffect(()=>{
    if (!selectedMaterial?.studyLoaded || !selectedMaterial.summary || selectedMaterial.summary.quickPreview ||
        selectedMaterial.summary.visualAidsSearched === true || selectedMaterial.hasExtractableText === false ||
        illustratingMaterialId || illustrationAttemptsRef.current.has(selectedMaterial.id)) return;
    if (selectedMaterial.summary.visualAids?.some(item=>item.imageUrl)) return;
    void generateIllustrations(selectedMaterial.id);
  },[selectedMaterial,illustratingMaterialId]);

  const summarise = async (materialId:string, mode:"rapid"|"comprehensive"="comprehensive") => {
    const startedAt = Date.now();
    setStudyGuideMode(mode);
    setTab("summary");
    const target = materials.find(item=>item.id===materialId);
    if (target?.hasExtractableText === false) {
      setTab("source");
      setError("This original file does not contain enough selectable text for AI study notes. You can still read or download it in Source Material.");
      return;
    }
    const existingQuestionCount = target?.questions?.length || 0;
    const sbaQuestionCount = Math.max(1, questionCount - existingQuestionCount);
    let sbaStarted = false;
    const shouldStartSba = existingQuestionCount < questionCount && questionGenerationStatus[materialId] !== "generating";
    setSummaryWorking(true);
    setError("");
    setNotice(mode === "rapid"
      ? "Preparing your rapid study guide. The deeper guide and practice questions remain available separately…"
      : "Expanding your study guide into comprehensive source coverage…");
    try {
      const response = await fetch("/api/learning/summarise",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({materialId,mode})
      });
      let summary: StudySummary|undefined;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/x-ndjson") && response.body) {
        if (!response.ok) await readResponse(response);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const handleEvent = (line:string) => {
          if (!line.trim()) return;
          const event = normaliseStudyStringsDeep(JSON.parse(line) as Record<string,unknown>);
          if (event.type === "preview" && event.preview && typeof event.preview === "object") {
            const preview = event.preview as StudySummary;
            setMaterials(current=>current.map(item=>item.id===materialId?{...item,summary:preview}:item));
            setNotice("Your quick source outline is ready. ClerkME is now building your " + (mode === "rapid" ? "rapid revision guide" : "detailed study guide") + "…");
            if (shouldStartSba && !sbaStarted) {
              sbaStarted = true;
              void generateQuestionsForMaterial(materialId,sbaQuestionCount,questionDifficulty,true);
            }
          } else if (event.type === "progress" && typeof event.message === "string") {
            setNotice(event.message);
          } else if (event.type === "completed" && event.summary && typeof event.summary === "object") {
            summary = event.summary as StudySummary;
          } else if (event.type === "failed") {
            throw new Error(typeof event.error === "string" ? event.error : "ClerkME could not complete this study guide. Your uploaded material is safe.");
          }
        };
        while (true) {
          const chunk = await reader.read();
          buffer += decoder.decode(chunk.value || new Uint8Array(), {stream:!chunk.done});
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          for (const line of lines) handleEvent(line);
          if (chunk.done) break;
        }
        if (buffer.trim()) handleEvent(buffer);
      } else {
        const started = normaliseStudyStringsDeep(await readResponse(response));
        summary = started.summary as StudySummary|undefined;
        if (started.preview && typeof started.preview === "object") {
          const preview = started.preview as StudySummary;
          setMaterials(current=>current.map(item=>item.id===materialId?{...item,summary:preview}:item));
          setNotice("Quick source outline ready. Your " + (mode === "rapid" ? "rapid revision guide" : "detailed study guide") + " is being generated…");
          if (shouldStartSba && !sbaStarted) {
            sbaStarted = true;
            void generateQuestionsForMaterial(materialId,sbaQuestionCount,questionDifficulty,true);
          }
        }
        if (!summary && typeof started.jobId === "string") {
          const jobId = started.jobId;
          const startedAt = Date.now();
          const maximumWaitMs = 12 * 60 * 1000;
          while (Date.now() - startedAt < maximumWaitMs) {
            await new Promise(resolve=>window.setTimeout(resolve,2500));
            const statusResponse = await fetch(
              "/api/learning/summarise?jobId="+encodeURIComponent(jobId),
              {credentials:"same-origin",cache:"no-store"}
            );
            const job = normaliseStudyStringsDeep(await readResponse(statusResponse));
            if (job.status === "completed" && job.summary) {
              summary = job.summary as StudySummary;
              break;
            }
            const elapsedSeconds = Math.floor((Date.now()-startedAt)/1000);
            setNotice(elapsedSeconds < 30
              ? "Analysing your lecture and organising its key concepts…"
              : elapsedSeconds < 90
                ? "Building detailed explanations, clinical links and exam-focused revision points…"
                : "Your study guide is taking a little longer than usual. Your uploaded material is safe; ClerkMe is still working.");
          }
        }
      }

      if (!summary) throw new Error("The study service did not return a completed guide. Your uploaded material is safe; please retry.");
      summary = normaliseStudyStringsDeep(summary) as StudySummary;
      setMaterials(current=>current.map(item=>item.id===materialId?{...item,summary:summary || null,hasSummary:true,studyLoaded:true}:item));
      const elapsedSeconds = ((Date.now()-startedAt)/1000).toFixed(1);
      setNotice(mode === "rapid"
        ? "Rapid study guide ready in " + elapsedSeconds + " seconds. Relevant images appear alongside matching topics when available."
        : "Comprehensive study guide ready in " + elapsedSeconds + " seconds. Relevant images appear alongside matching topics when available.");
      setTab("summary");
      illustrationAttemptsRef.current.delete(materialId);
      setIllustrationsByMaterial(current=>({...current,[materialId]:[]}));
      try { window.sessionStorage.removeItem(illustrationSessionKey(materialId)); } catch {}
      void generateIllustrations(materialId);
      // Start SBA generation only after the selected study guide has completed.
      // It runs independently so the learner can begin reading the guide immediately.
      if (shouldStartSba && !sbaStarted) {
        sbaStarted = true;
        void generateQuestionsForMaterial(materialId,sbaQuestionCount,questionDifficulty,true);
      }
    } catch(e) {
      setError(safeStudyError(e instanceof Error?e.message:"Could not prepare this study guide."));
      setNotice("Your uploaded material is saved. study guide can be generated again when the study service is available.");
    } finally { setSummaryWorking(false); }
  };

  const upload = async () => {
    if (!file) { setError("Choose a document first."); return; }
    const matchingSubject = libraryMode==="general"
      ? materials.find(item=>isCustomSubjectUnit(item.unit) && unitName(item.unit).toLocaleLowerCase("en")===customSubject.trim().toLocaleLowerCase("en"))
      : undefined;
    const uploadUnit = libraryMode==="general" ? (matchingSubject?.unit || makeCustomSubjectUnit(customSubject)) : unit;
    if(libraryMode==="general" && customSubject.trim().length<2){
      setError("Enter the subject or course name for this material.");
      return;
    }
    if(libraryMode==="general" && customSubject.trim().length>70){
      setError("Keep the subject or course name under 70 characters.");
      return;
    }
    setUploading(true); setError(""); setNotice(""); setAnswer(null);
    try {
      setNotice("Reading your file and preparing it for study…");
      const extracted = await extractStudyFile(file);
      const extractedText = extracted.text.trim();
      if (extractedText.length < 100) {
        throw new Error("ClerkME could not extract enough readable text to create a reliable study guide. The file has not been uploaded. Try a clearer scan or a text-based copy.");
      }
      const uploadForm = new FormData();
      uploadForm.append("title",title.trim() || file.name.replace(/\\.[^.]+$/,""));
      uploadForm.append("sourceName",file.name);
      uploadForm.append("unit",uploadUnit);
      uploadForm.append("category",category);
      uploadForm.append("contentText",extractedText);
      uploadForm.append("originalFile",file,file.name);
      const response = await fetch("/api/learning/materials",{
        method:"POST",credentials:"same-origin",body:uploadForm
      });
      const data = await readResponse(response);
      const material = data.material as StudyMaterial;
      setMaterials(current=>[{...material,summary:null,questions:[],hasSummary:false,questionCount:0,studyLoaded:true},...current.filter(item=>item.id!==material.id)]);
      setSelectedId("");
      setShowUploadForm(false);
      setMobileDetailOpen(false);
      setSourceTextByMaterial(current=>({...current,[material.id]:extractedText}));
      setLibraryUnit(uploadUnit);
      setUnit(uploadUnit);
      setTitle(""); setFile(null);
      setNotice("Material uploaded successfully. Its study guide is being prepared in the background. Select it from your library whenever you are ready to open it.");
      setTab("summary");
      window.requestAnimationFrame(()=>document.getElementById("materials-library-card")?.scrollIntoView({behavior:"smooth",block:"start"}));
      await summarise(material.id,"comprehensive");
    } catch(e) {
      setNotice("");
      setError(e instanceof Error?e.message:"Could not upload this material.");
    } finally { setUploading(false); }
  };

  const generateQuestionsForMaterial = async (
    materialId:string,
    count:number,
    level:string,
    background=false
  ) => {
    setQuestionsWorking(true);
    setQuestionGenerationStatus(current=>({...current,[materialId]:"generating"}));
    setQuestionGenerationErrors(current=>({...current,[materialId]:""}));
    if (!background) {
      setError("");
      setNotice("Creating new, non-repeating SBA questions from your uploaded lecture…");
    }
    try {
      // Keep each HTTP request short enough to avoid Cloudflare's 524 timeout.
      // The API generates at most three questions per request and persists each batch.
      let remaining = Math.max(1, count);
      let added = 0;
      let batchWarning = "";
      while (remaining > 0) {
        const batchCount = Math.min(5, remaining);
        setNotice(`Creating your SBA questions… ${added} of ${count} completed`);
        const response = await fetch("/api/learning/generate",{
          method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
          body:JSON.stringify({materialId,count:batchCount,level})
        });
        const data = await readResponse(response);
        const batchAdded = Number(data.generated || 0);
        added += batchAdded;
        remaining -= batchAdded;
        if (data.warning) batchWarning = String(data.warning);
        // Publish each saved batch while the rest of the question set is built.
        if (batchAdded > 0) await loadMaterialStudy(materialId);
        if (batchAdded < batchCount || data.complete === false) break;
      }
      await loadMaterials();
      const refreshedStudy = await loadMaterialStudy(materialId);
      const refreshedMaterial = materials.find(item=>item.id===materialId);
      const total = Number(refreshedStudy?.questionCount || (Array.isArray(refreshedStudy?.questions) ? refreshedStudy.questions.length : 0) || added || 0);
      setQuestionGenerationStatus(current=>({...current,[materialId]:total>0?"ready":"failed"}));
      if (!background && selectedId===materialId) {
        setQuestionIndex(0);
        setQuestionAnswers({});
        setQuizFinished(false);
        setQuizMode("practice");
        setLiveDeadline(null);
        setLiveStartedAt(null);
        setLiveElapsedSeconds(0);
        setLiveTimedOut(false);
        if (total > 0) setTab("questions");
        setNotice(remaining > 0 || batchWarning
          ? `Added ${added} new distinct questions. Your set now contains ${total} questions. ${batchWarning || "Some questions could not be completed in this attempt; your saved questions are safe. You can retry for the remainder."}`
          : `Added ${added} new SBA questions from ${refreshedMaterial?.title || "this material"}. Your library now contains ${total} distinct questions for this lecture.`);
      }
      return true;
    } catch(e) {
      const message = e instanceof Error?e.message:"Could not create questions from this material.";
      setQuestionGenerationStatus(current=>({...current,[materialId]:"failed"}));
      setQuestionGenerationErrors(current=>({...current,[materialId]:message}));
      if (!background) setError(message);
      return false;
    } finally { setQuestionsWorking(false); }
  };

  const generateQuestions = async () => {
    if (!selectedMaterial) return;
    if (selectedMaterial.hasExtractableText === false) {
      setTab("source");
      setError("This original file has no selectable text for reliable question generation. Read it in Source Material or upload a text-based/OCR version for MCQs.");
      return;
    }
    await generateQuestionsForMaterial(selectedMaterial.id,questionCount,questionDifficulty,false);
  };

  const ask = async () => {
    if (!selectedMaterial || question.trim().length<5) return;
    if (selectedMaterial.hasExtractableText === false && !selectedMaterial.summary) {
      setTab("source");
      setError("This original file has no selectable text for the study tutor. Use OCR or upload a text-based copy to enable AI explanations.");
      return;
    }
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
    if (!window.confirm("Remove this material, its Study Guide and its generated questions from your private library?")) return;
    setError(""); setNotice("");
    try {
      await readResponse(await fetch("/api/learning/materials",{
        method:"DELETE",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({id:materialId})
      }));
      const next = materials.filter(item=>item.id!==materialId);
      setMaterials(next);
      if (userKey) {
        try {
          const resumeKey = "clerkme:last-study:" + userKey;
          const savedResume = JSON.parse(window.localStorage.getItem(resumeKey) || "null") as Record<string, unknown> | null;
          if (savedResume?.materialId === materialId) {
            window.localStorage.removeItem(resumeKey);
            window.dispatchEvent(new CustomEvent("clerkme:study-progress", {detail:{cleared:true}}));
          }
        } catch {}
      }
      if (selectedId===materialId) { setSelectedId(""); setMobileDetailOpen(false); }
      setAnswer(null); setNotice("Material removed from your library.");
    } catch(e) { setError(e instanceof Error?e.message:"Could not remove this material."); }
  };

  return (
    <div className={"materials-workspace"+(mobileDetailOpen?" is-mobile-detail":"")}>
      <div className="page-intro">
        <div className="eyebrow">YOUR PRIVATE STUDY LIBRARY</div>
        <h1>My materials</h1>
        <p>Your uploaded lectures, slides and notes live here. Select a material to open its study guide, original file, practice questions or the AI tutor.</p>
      </div>
      <div className="materials-safety-note materials-privacy-reminder">
        <strong>Privacy reminder:</strong>
        <span>Remove patient identifiers and confidential personal or institutional information before uploading learning resources.</span>
      </div>
      <section className="materials-library-personaliser" aria-label="Customise your library">
        <div className="materials-library-personaliser-copy">
          <span className="materials-library-personaliser-kicker">MAKE CLERKME YOURS</span>
          <h2>What are you studying?</h2>
          <p>Choose the library structure that fits your course. You can switch at any time without deleting or moving your uploads.</p>
        </div>
        <div className="materials-library-mode-options" role="group" aria-label="Choose your library type">
          <button type="button" className={libraryMode==="clinical"?"active":""} aria-pressed={libraryMode==="clinical"} onClick={()=>selectLibraryMode("clinical")} disabled={liveInProgress}>
            <span className="materials-library-mode-icon">✚</span>
            <span><strong>Clinical & health sciences</strong><small>Medicine, nursing, pharmacy and allied health</small></span>
            <i aria-hidden="true">{libraryMode==="clinical"?"✓":"○"}</i>
          </button>
          <button type="button" className={libraryMode==="general"?"active":""} aria-pressed={libraryMode==="general"} onClick={()=>selectLibraryMode("general")} disabled={liveInProgress}>
            <span className="materials-library-mode-icon">▤</span>
            <span><strong>General study</strong><small>Any course, subject or professional learning</small></span>
            <i aria-hidden="true">{libraryMode==="general"?"✓":"○"}</i>
          </button>
        </div>
        {libraryMode==="general" && <p className="materials-library-mode-note"><strong>Your subjects, your structure.</strong> Name the subject when you upload a file — for example Economics, Law, Computer Science, Psychology, Research Methods or Project Management. ClerkMe will organise resources and build revision questions from the uploaded source.</p>}
      </section>
              <section id="materials-library-card" className="materials-library-card materials-library-first-card">
          <div className="materials-library-heading">
            <div><div className="eyebrow">YOUR UPLOADED FILES</div><h2>My library <span>{modeMaterials.length}</span></h2></div>
            <button type="button" className="text-link" disabled={liveInProgress} onClick={()=>loadMaterials().catch(e=>setError(e.message))}>↻ Refresh</button>
          </div>
          <div className="materials-unit-filter">
            <div className="materials-unit-filter-heading">
              <strong>{libraryMode==="clinical"?"Browse by clinical unit":"Browse by subject"}</strong>
              <small>{libraryMode==="clinical"?"Choose a unit to keep its lectures and notes together.":"Choose a subject to see only its own learning resources."}</small>
            </div>
            <label className="materials-unit-select-label">
              <span>{libraryMode==="clinical"?"Clinical unit":"Subject / course"}</span>
              <select value={libraryUnit} onChange={event=>selectLibraryUnit(event.target.value)} disabled={liveInProgress} aria-label={libraryMode==="clinical"?"Choose a clinical unit":"Choose a subject"}>
                <option value="select" disabled>Choose a {libraryMode==="clinical"?"clinical unit":"subject"}</option>
                <option value="all">All {libraryMode==="clinical"?"units":"subjects"} ({modeMaterials.length})</option>
                {libraryBrowseUnits.map(item=>{
                  const count=modeMaterials.filter(material=>material.unit===item.id).length;
                  return <option key={item.id} value={item.id}>{item.name} ({count})</option>;
                })}
              </select>
            </label>
          </div>
          {libraryUnit!=="select"&&<label className="materials-library-search">
            <span aria-hidden="true">⌕</span>
            <input type="search" value={librarySearch} onChange={event=>setLibrarySearch(event.target.value)} placeholder="Search lectures, topics or files in this view" aria-label="Search uploaded materials"/>
            {librarySearch&&<button type="button" onClick={()=>setLibrarySearch("")} aria-label="Clear search">×</button>}
          </label>}
          {modeMaterials.length===0 ? <div className="materials-empty materials-library-empty"><span>▤</span><strong>Your library is ready</strong><p>Upload your first lecture, slide deck or revision document. It will be organised under the unit or subject you choose.</p><button type="button" className="primary-button" onClick={openUploadForm}>Upload your first material <span>→</span></button></div> :
            libraryUnit==="select" ? <div className="materials-empty materials-library-empty"><span>▤</span><strong>Select a {libraryMode==="clinical"?"clinical unit":"subject"}</strong><p>Choose a unit from the menu above to see only the materials uploaded there. Select “All {libraryMode==="clinical"?"units":"subjects"}” in that same menu to see your full library.</p></div> :
            visibleMaterials.length===0 ? <div className="materials-empty materials-library-empty"><span>⌕</span><strong>{librarySearch.trim()?"No matching materials":libraryUnit==="all"?"No uploaded materials yet":"No materials in "+unitName(libraryUnit)+" yet"}</strong><p>{librarySearch.trim()?"Try another title or filename, or clear your search.":libraryUnit==="all"?(libraryMode==="clinical"?"Upload a lecture or choose a clinical unit to start building your library.":"Add your first subject and upload a resource. Your subjects will become the folders for your library."):"Upload a resource for this "+(libraryMode==="clinical"?"unit":"subject")+" and it will appear here. Your other "+(libraryMode==="clinical"?"units":"subjects")+" will remain untouched."}</p><button type="button" className="secondary-button" onClick={()=>{if(librarySearch.trim()){setLibrarySearch("");}else{openUploadForm();}}}>{librarySearch.trim()?"Clear search":"Upload to "+(libraryUnit==="all"?"your library":unitName(libraryUnit))}</button></div> :
            <div className="materials-unit-groups">
              {groupedVisibleMaterials.map(group=>{
                const expanded=!!expandedUnits[group.id];
                const shownMaterials=expanded?group.materials:group.materials.slice(0,3);
                const remaining=group.materials.length-shownMaterials.length;
                return <section className="materials-unit-group" key={group.id}>
                  <div className="materials-unit-group-heading"><div><h3>{group.name}</h3><span>{group.materials.length} {group.materials.length===1?"material":"materials"}</span></div>
                    {group.materials.length>3&&<button type="button" className="materials-view-more" aria-expanded={expanded} onClick={()=>setExpandedUnits(current=>({...current,[group.id]:!current[group.id]}))}>{expanded?"Show fewer":"View all "+group.materials.length} <span aria-hidden="true">{expanded?"⌃":"⌄"}</span></button>}
                  </div>
                  <div className="materials-list">
                    {shownMaterials.map(item=><div className={item.id===selectedId?"materials-list-item selected":"materials-list-item"} key={item.id}>
                      <button type="button" className="materials-select" aria-pressed={item.id===selectedId} disabled={liveInProgress} onClick={()=>openMaterial(item)}>
                        <span className="materials-file-badge">▤</span>
                        <span className="materials-item-copy"><strong>{item.title}</strong><small>{item.category} · {formatDate(item.createdAt)}</small><span>{item.summary?.quickPreview?"Study guide processing":item.studyLoaded?(item.summary?"Study guide ready":"Study guide not created yet"):(item.hasSummary?"Study guide ready":"Study guide not created yet")} · {item.studyLoaded?(item.questions?.length||0):(item.questionCount||0)} questions</span></span>
                        <span className="materials-open-label">Open <b aria-hidden="true">›</b></span>
                      </button>
                      <button type="button" className="materials-delete" title={"Remove "+item.title} aria-label={"Remove "+item.title} disabled={liveInProgress} onClick={()=>remove(item.id)}>×</button>
                    </div>)}
                  </div>
                  {!expanded&&remaining>0&&<p className="materials-preview-note">Showing 3 of {group.materials.length} uploads.</p>}
                </section>;
              })}
            </div>}
          {materials.length>0&&libraryUnit!=="select"&&<div className="materials-library-footer"><span>Choose a material above to open its study features.</span><button type="button" className="materials-add-link" onClick={openUploadForm}>＋ Add another material</button></div>}
        </section>
      {showUploadForm&&<section id="materials-upload-card" className="materials-upload-card">
        <div className="materials-upload-heading-row"><div><div className="eyebrow">ADD TO YOUR LIBRARY</div><h2>Upload a new material</h2><p>{libraryMode==="clinical"?"Choose the clinical unit for this resource.":"Choose the subject this resource belongs to. You can create a new subject by typing its name."}</p></div><button type="button" className="materials-upload-close" onClick={closeUploadForm} aria-label="Close upload form">×</button></div>
        {libraryMode==="clinical"
          ? <label>Clinical unit
              <select value={unit} onChange={event=>setUnit(event.target.value)}>
                {clinicalUnits.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          : <label>Subject / course <span className="materials-field-required">Required</span>
              <input value={customSubject} onChange={event=>setCustomSubject(event.target.value)} maxLength={70} list="clerkme-custom-subjects" placeholder="e.g. Economics, Computer Science, Psychology"/>
              <datalist id="clerkme-custom-subjects">{libraryBrowseUnits.map(item=><option key={item.id} value={item.name}/>)}</datalist>
              <small>Use any course, subject, module or professional-learning topic.</small>
            </label>}
        <label>Material type
          <select value={category} onChange={event=>setCategory(event.target.value)}>
            {libraryMode==="clinical"
              ? <><option>Lecture notes</option><option>Lecture slides</option><option>Textbook extract</option><option>Clinical guideline</option><option>Personal revision notes</option><option>Other study resource</option></>
              : <><option>Lecture notes</option><option>Lecture slides</option><option>Textbook extract</option><option>Research paper</option><option>Coursework / assignment</option><option>Personal revision notes</option><option>Reference material</option><option>Other study resource</option></>}
          </select>
        </label>
        <label>Display title (optional)
          <input value={title} onChange={event=>setTitle(event.target.value)} placeholder={libraryMode==="clinical"?"e.g. Acute coronary syndromes — lecture 2":"e.g. Introduction to microeconomics — week 2"}/>
        </label>
        <label className="materials-file-picker">
          <span className="materials-file-icon">⇧</span>
          <span><strong>{file?file.name:"Choose a file to upload"}</strong><small>{file?`${Math.max(1,Math.round(file.size/1024))} KB · ready to extract`:STUDY_FILE_TYPES+" · up to 20 MB"}</small></span>
          <input type="file" accept={STUDY_FILE_ACCEPT} onChange={event=>{setFile(event.target.files?.[0]||null);setError("");setNotice("");}}/>
        </label>
        <button className="primary-button materials-action-button" onClick={upload} disabled={!file||uploading||(libraryMode==="general"&&customSubject.trim().length<2)}>
          {uploading?"Reading and preparing your material…":"Upload material"} <span>→</span>
        </button>
        <div className="materials-processing-steps"><span>01 · Extract content</span><span>02 · Build study guide</span><span>03 · Generate practice</span></div>
      </section>}
      



      {error&&<p className="auth-error materials-feedback">{error}</p>}
      {notice&&<p className="success-note materials-feedback">{notice}</p>}

      {selectedMaterial && mobileDetailOpen && <section id="materials-detail-card" className="materials-detail-card">
        <button type="button" className="materials-mobile-back" onClick={returnToLibrary} disabled={liveInProgress} aria-label="Back to study library">← <span>All materials</span></button>
        <div className="materials-detail-heading">
          <div>
            <div className="eyebrow">{unitName(selectedMaterial.unit).toUpperCase()} · {selectedMaterial.category.toUpperCase()}</div>
            <h2>{selectedMaterial.title}</h2>
            <p>{selectedMaterial.sourceName} · Added {formatDate(selectedMaterial.createdAt)}</p>
          </div>
        </div>
        <div className="materials-study-tools">
          <section className="materials-study-tool-card materials-study-guide-tool" aria-labelledby="materials-summary-mode-title">
            <div className="materials-study-tool-heading">
              <span className="materials-study-tool-kicker">STUDY GUIDE</span>
              <h3 id="materials-summary-mode-title">Choose a format</h3>
            </div>
            <div className="materials-summary-mode-picker">
              <div className="materials-summary-mode-options" role="group" aria-label="Choose study guide format">
                <button type="button" className={studyGuideMode==="comprehensive"?"selected":""} aria-pressed={studyGuideMode==="comprehensive"} onClick={()=>setStudyGuideMode("comprehensive")} disabled={working||liveInProgress}>
                  <span className="materials-summary-mode-radio" aria-hidden="true"><span/></span>
                  <span className="materials-summary-mode-copy"><strong>Detailed guide</strong><small>Recommended</small></span>
                </button>
                <button type="button" className={studyGuideMode==="rapid"?"selected":""} aria-pressed={studyGuideMode==="rapid"} onClick={()=>setStudyGuideMode("rapid")} disabled={working||liveInProgress}>
                  <span className="materials-summary-mode-radio" aria-hidden="true"><span/></span>
                  <span className="materials-summary-mode-copy"><strong>Rapid revision</strong><small>Quick review</small></span>
                </button>
              </div>
              <div className="materials-summary-mode-footer">
                <p>{studyGuideMode==="comprehensive"
                  ? "Fuller explanations, mechanisms, clinical reasoning and exam-focused coverage."
                  : "Concise notes focused on essential concepts and high-yield facts."}</p>
                <button className="primary-button materials-summary-generate" onClick={()=>summarise(selectedMaterial.id,studyGuideMode)} disabled={working||liveInProgress||selectedMaterial.hasExtractableText===false}>
                  {summaryWorking
                    ? "Preparing guide…"
                    : selectedMaterial.hasExtractableText===false
                      ? "AI notes need readable text"
                      : selectedMaterial.summary?.generationMode===studyGuideMode
                        ? "Refresh guide"
                        : "Generate guide"}
                </button>
              </div>
            </div>
          </section>
          <section className="materials-study-tool-card materials-practice-tool" aria-labelledby="materials-practice-title">
            <div className="materials-study-tool-heading">
              <span className="materials-study-tool-kicker">ACTIVE RECALL</span>
              <h3 id="materials-practice-title">Practice questions</h3>
              <p>Create an exam-focused question set from this material.</p>
            </div>
            <div className="materials-generation-controls">
              <label>Number of questions
                <select value={questionCount} onChange={event=>setQuestionCount(Number(event.target.value))} disabled={working||liveInProgress}>
                  <option value={10}>10 questions</option><option value={15}>15 questions</option><option value={25}>25 questions</option><option value={40}>40 questions</option>
                </select>
              </label>
              <label>Difficulty
                <select value={questionDifficulty} onChange={event=>setQuestionDifficulty(event.target.value)} disabled={working||liveInProgress}>
                  <option>Mixed</option><option>Easy</option><option>Moderate</option><option>Hard</option>
                </select>
              </label>
            </div>
            <button className="primary-button materials-practice-generate" onClick={generateQuestions} disabled={working||liveInProgress||selectedMaterial.hasExtractableText===false}>
              {questionsWorking?(selectedMaterialIsGeneral?"Generating practice questions…":"Generating SBA questions…"):summaryWorking?"Building study resources…":selectedMaterial.questions?.length?(selectedMaterialIsGeneral?"Generate more practice questions":"Generate more SBA questions"):"Generate "+questionCount+(selectedMaterialIsGeneral?" practice questions":" SBA questions")} <span>→</span>
            </button>
          </section>
        </div>
        <div className="materials-tabs" role="tablist" aria-label="Study options for this material">
          <button type="button" role="tab" aria-selected={tab==="summary"} className={tab==="summary"?"active":""} disabled={liveInProgress} onClick={()=>{setTab("summary");setError("");}}>Study Guide</button>
          <button type="button" role="tab" aria-selected={tab==="source"} className={tab==="source"?"active":""} disabled={liveInProgress} onClick={()=>{setTab("source");setError("");}}>Original file</button>
          <button type="button" role="tab" aria-selected={tab==="questions"} className={tab==="questions"?"active":""} onClick={()=>{setTab("questions");setError("");}}>Practice questions <span className="materials-tab-count">{selectedMaterial.studyLoaded?(selectedMaterial.questions?.length||0):(selectedMaterial.questionCount||"…")}</span></button>
          <button type="button" role="tab" aria-selected={tab==="ask"} className={tab==="ask"?"active":""} disabled={liveInProgress||(selectedMaterial.hasExtractableText===false&&!selectedMaterial.summary)} onClick={()=>{setTab("ask");setAnswer(null);setError("");}}>Ask ClerkME</button>
        </div>

        {tab==="source" && <section className="materials-source-viewer">
          <div className="eyebrow">ORIGINAL FILE</div>
          <h3>{selectedMaterial.sourceName}</h3>
          <p className="materials-source-meta">{unitName(selectedMaterial.unit)} · {selectedMaterial.category} · {selectedMaterial.originalFileAvailable ? "Original file preserved" : "Older upload: original file not retained"}</p>
          {selectedMaterial.originalFileAvailable
            ? <SourceFileViewer materialId={selectedMaterial.id} fileName={selectedMaterial.sourceName} mimeType={selectedMaterial.mimeType} originalSizeBytes={selectedMaterial.originalSizeBytes} extractedText={sourceTextByMaterial[selectedMaterial.id]||""}/>
            : <div className="materials-empty"><strong>Original file unavailable for this older upload</strong><p>ClerkMe saved its extracted text before original-file storage was enabled. Upload the original file again to view it in its original format.</p></div>}
          <details className="source-extracted-details">
            <summary>View extracted text used by the AI</summary>
            {sourceTextByMaterial[selectedMaterial.id] !== undefined
              ? sourceTextByMaterial[selectedMaterial.id]
                ? <pre>{sourceTextByMaterial[selectedMaterial.id]}</pre>
                : <p>ClerkMe could not extract selectable text from this file. The original document above remains available to read and download.</p>
              : <p>Loading extracted text…</p>}
          </details>
        </section>}

        {tab==="summary" && <>
          {selectedMaterial.summary ? <div className="study-summary" id="study-guide-readable-content">
            <div className="study-guide-toolbar">
              <div><span className="eyebrow">{selectedMaterial.summary.quickPreview?"QUICK SOURCE OUTLINE":"YOUR STUDY GUIDE"}</span><p>{selectedMaterial.summary.quickPreview?"Instant extraction from your upload. The detailed AI guide is still being generated and will replace this outline automatically when ready.":"Read the topic in sequence, review the key exam points, then test yourself with the practice questions."}</p>{selectedMaterial.summary.generationProvider==="Cloudflare Workers AI"&&<small className="study-guide-provider-note">Your study guide is ready — built around the material you shared to support your learning.</small>}</div>
              <div className="study-guide-toolbar-actions">
                {activeQuestions.length>0&&<button type="button" className="primary-button" onClick={()=>setTab("questions")}>{selectedMaterialIsGeneral?"Start practice":"Start MCQ practice"} <span>→</span></button>}
                {!!flashcardCandidates.length&&<button type="button" className="secondary-button" onClick={()=>{
                  try {
                    window.localStorage.setItem("clerkme:flashcards:pending:"+userKey,JSON.stringify({
                      title:selectedMaterial.title+" · Revision cards",
                      unit:selectedMaterial.unit,
                      cards:flashcardCandidates
                    }));
                    window.dispatchEvent(new CustomEvent("clerkme:navigate",{detail:{section:"flashcards"}}));
                  } catch {
                    window.alert("ClerkME could not prepare the flashcard deck in this browser. Please try again.");
                  }
                }}>Make {flashcardCandidates.length} flashcards</button>}
                <button type="button" className="secondary-button" onClick={()=>setTab("source")}>Open original file</button>
                <button type="button" className="secondary-button" onClick={()=>window.print()}>Print / Save PDF</button>
                <button type="button" className="secondary-button study-inline-visual-refresh" disabled={illustratingMaterialId===selectedMaterial.id} onClick={()=>generateIllustrations(selectedMaterial.id,true)}>{illustratingMaterialId===selectedMaterial.id?"Finding images…":selectedVisuals.length?"Refresh images":"Find images"}</button>
              </div>
            </div>
            {!!illustrationErrors[selectedMaterial.id]&&<p className="study-inline-visual-status" role="status">{illustrationErrors[selectedMaterial.id]}</p>}
            <StudyGuideReadAloud targetId="study-guide-readable-content" />
            {selectedMaterial.summary.quickPreview&&<div className="study-quick-preview-banner" role="status">
              <span className="study-preview-dot" aria-hidden="true"/>
              <div><strong>Quick-start notes are ready</strong><p>You can begin with the original material highlights now. ClerkMe is still building the full explanations, mnemonics, clinical links and exam-focused guide.</p></div>
            </div>}
            {!!selectedMaterial.summary.sections?.length&&<nav className="study-contents" aria-label="Study guide contents"><strong>In this guide</strong><div>{selectedMaterial.summary.sections.map((section,index)=><a key={index} href={`#study-section-${index+1}`}>{String(index+1).padStart(2,"0")} · {section.heading}</a>)}</div></nav>}
            
            <section className="study-summary-overview"><div className="eyebrow">TOPIC OVERVIEW</div><p>{selectedMaterial.summary.overview}</p></section>
            {!!unplacedVisuals.length&&<div className="study-inline-visuals study-unplaced-visuals">
              {unplacedVisuals.map((visual,index)=><InlineStudyVisual visual={visual} key={visual.sourceUrl||index}/>)}
            </div>}
            {!!illustratingMaterialId&&illustratingMaterialId===selectedMaterial.id&&<p className="study-inline-visual-status" role="status">Searching Wikimedia Commons for relevant educational images…</p>}
            {!!selectedMaterial.summary.learningObjectives?.length && <section className="study-summary-block"><h3>Learning objectives</h3><ul>{selectedMaterial.summary.learningObjectives.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            {!!topHighYieldPoints.length&&<section className="study-summary-block study-exam-focus study-high-yield-overview">
              <div className="eyebrow">{selectedMaterial.summary.quickPreview?"SOURCE HIGHLIGHTS":selectedMaterialIsGeneral?"KEY KNOWLEDGE":"KEY EXAM POINTS"}</div><h3>{selectedMaterial.summary.quickPreview?"Key statements extracted from your upload":selectedMaterialIsGeneral?"Important concepts, methods and distinctions to master":"Core facts, mechanisms and distinctions to master"}</h3>
              <p className="study-section-intro">{selectedMaterial.summary.quickPreview?"These are direct extracts from your source to help you start revising while the complete guide is prepared. They have not yet been ranked or interpreted by the AI.":"These are the exam-relevant points to understand and retain. Each point should be read with its explanation and the detailed topic notes that follow."}</p>
              <ol>{topHighYieldPoints.map((item,index)=><li key={index}>{item}</li>)}</ol>
              
            </section>}
<details className="study-dive-deeper-dropdown" id="study-detailed-topic-explanations" onToggle={event=>{if(event.currentTarget.open)setExpandedStudySections(Array.from({length:studySectionCount},(_,index)=>index));}}>
              <summary><span className="study-dive-deeper-copy"><span className="study-dive-deeper-kicker"><span className="study-dive-deeper-spark" aria-hidden="true">✦</span> {selectedMaterialIsGeneral?"YOUR COMPLETE STUDY GUIDE":"YOUR COMPLETE CLINICAL GUIDE"}</span><strong>Dive deeper</strong><small>{selectedMaterialIsGeneral?"Explore detailed explanations, key concepts, methods, comparisons and practical applications.":"Explore the full explanations, diagnosis patterns, investigations, differentials and step-by-step management."}</small><span className="study-dive-deeper-meta"><span>{studySectionCount} detailed topics</span><span>{selectedMaterialIsGeneral?"Practical insights":"Clinical insights"}</span><span>{selectedMaterialIsGeneral?"Ready to revise":"Exam-ready"}</span></span></span><span className="study-dive-deeper-action"><span>Explore guide</span><span className="study-dive-deeper-chevron" aria-hidden="true">⌄</span></span></summary>
              <div className="study-summary-sections">
              <div className="study-section-accordion-toolbar">
                <div><div className="eyebrow study-detailed-notes-label">DETAILED TOPIC EXPLANATIONS</div><p>{selectedMaterialIsGeneral?"Open any topic to explore its explanation, real-world relevance and assessment points.":"Open any topic to read its full explanation, clinical relevance and examination points."}</p></div>
                <button type="button" className="study-expand-all-button" onClick={toggleAllStudySections}>{allStudySectionsExpanded?"Collapse all":"Expand all"} <span aria-hidden="true">{allStudySectionsExpanded?"⌃":"⌄"}</span></button>
              </div>
              {selectedMaterial.summary.sections?.map((section,index)=>{
                const expanded=expandedStudySections.includes(index);
                return <article id={`study-section-${index+1}`} className={"study-summary-section study-expandable-section"+(expanded?" is-expanded":"")} key={index}>
                  <div className="study-expandable-section-header">
                    <div className="study-summary-section-heading"><span>{String(index+1).padStart(2,"0")}</span><h3>{section.heading}</h3></div>
                    <button type="button" className="study-section-toggle" aria-expanded={expanded} aria-controls={`study-section-details-${index+1}`} onClick={()=>toggleStudySection(index)}>
                      <span>{expanded?"Hide details":"Dive deeper"}</span><span className="study-section-toggle-icon" aria-hidden="true">{expanded?"⌃":"⌄"}</span>
                    </button>
                  </div>
                  <p className="study-section-lead">{section.summary}</p>
                  {selectedVisuals.filter(visual=>visualMatchesHeading(visual.sourceSection,section.heading)).length>0&&<div className="study-inline-visuals">
                    {selectedVisuals.filter(visual=>visualMatchesHeading(visual.sourceSection,section.heading)).map((visual,visualIndex)=><InlineStudyVisual visual={visual} key={visual.sourceUrl||visualIndex}/>)}
                  </div>}
                  <div id={`study-section-details-${index+1}`} className="study-section-expanded-content" hidden={!expanded}>
                    {section.sourceLocator&&<small className="study-source-locator">Source: {section.sourceLocator}</small>}
                    {!!section.subsections?.length&&<div className="study-topic-subsections">{section.subsections.map((subsection,subIndex)=><section className="study-topic-subsection" key={subIndex}>
                      <div className="study-subsection-kicker">TEACH IT · {String(subIndex+1).padStart(2,"0")}</div>
                      <h4>{subsection.heading}</h4>
                      <p>{subsection.explanation}</p>
                      {selectedVisuals.filter(visual=>visualMatchesHeading(visual.sourceSection,subsection.heading)).length>0&&<div className="study-inline-visuals">
                        {selectedVisuals.filter(visual=>visualMatchesHeading(visual.sourceSection,subsection.heading)).map((visual,visualIndex)=><InlineStudyVisual visual={visual} key={visual.sourceUrl||visualIndex}/>)}
                      </div>}
                      {!!subsection.keyPoints?.length&&<ul>{subsection.keyPoints.map((point,pointIndex)=><li key={pointIndex}>{point}</li>)}</ul>}
                      {subsection.mentalModel&&<div className="study-mental-model"><span>MAKE IT CLICK</span><p>{subsection.mentalModel}</p></div>}
                      {subsection.memoryHook&&<div className="study-memory-hook"><span className="study-learning-label">MEMORY ANCHOR</span><p>{subsection.memoryHook}</p></div>}
                      {subsection.recallQuestion&&<details className="study-active-recall"><summary><span>PAUSE & RECALL</span><strong>{subsection.recallQuestion}</strong><small>Think of your answer before revealing it</small></summary>{subsection.recallAnswer&&<div className="study-recall-answer"><b>Answer and reasoning</b><p>{subsection.recallAnswer}</p></div>}</details>}
                    </section>)}</div>}
                    {section.diagnosisPattern&&<section className="study-clinical-framework">
                      <div className="eyebrow">CLINICAL RECOGNITION</div><h4>Diagnosis pattern</h4>
                      {section.diagnosisPattern.patternSummary&&<p className="study-clinical-pattern-summary">{section.diagnosisPattern.patternSummary}</p>}
                      {section.diagnosisPattern.typicalPresentation&&<div className="study-clinical-pattern-card"><strong>Typical presentation</strong><p>{section.diagnosisPattern.typicalPresentation}</p></div>}
                      <div className="study-clinical-cue-grid">
                        {!!section.diagnosisPattern.historyClues?.length&&<div className="study-clinical-pattern-card"><strong>Key history</strong><ul>{section.diagnosisPattern.historyClues.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}
                        {!!section.diagnosisPattern.examinationClues?.length&&<div className="study-clinical-pattern-card"><strong>Examination findings</strong><ul>{section.diagnosisPattern.examinationClues.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}
                        {!!section.diagnosisPattern.diagnosticCriteria?.length&&<div className="study-clinical-pattern-card"><strong>Diagnostic criteria</strong><ul>{section.diagnosisPattern.diagnosticCriteria.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}
                        {!!section.diagnosisPattern.redFlags?.length&&<div className="study-clinical-pattern-card is-warning"><strong>Red flags and urgent features</strong><ul>{section.diagnosisPattern.redFlags.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}
                      </div>
                      {!!section.diagnosisPattern.investigations?.length&&<div className="study-table-wrap study-clinical-table"><strong>Investigations: expected pattern and interpretation</strong><table><thead><tr><th>Investigation</th><th>Expected finding</th><th>Clinical interpretation</th></tr></thead><tbody>{section.diagnosisPattern.investigations.map((item,i)=><tr key={i}><th>{item.test}</th><td>{item.expectedFinding}</td><td>{item.interpretation}</td></tr>)}</tbody></table></div>}
                      {!!section.diagnosisPattern.differentialDiagnoses?.length&&<div className="study-table-wrap study-clinical-table"><strong>Differential diagnosis: how to distinguish alternatives</strong><table><thead><tr><th>Alternative diagnosis</th><th>Distinguishing clues</th></tr></thead><tbody>{section.diagnosisPattern.differentialDiagnoses.map((item,i)=><tr key={i}><th>{item.diagnosis}</th><td>{item.distinguishingFeatures}</td></tr>)}</tbody></table></div>}
                    </section>}
                    {!!section.managementPlan?.length&&<section className="study-management-plan">
                      <div className="eyebrow">CLINICAL MANAGEMENT</div><h4>Detailed management approach</h4><p className="study-management-intro">Follow the sequence supported by the uploaded material. Review the rationale, monitoring and cautions for each step.</p>
                      <div className="study-table-wrap study-clinical-table"><table><thead><tr><th>Phase / priority</th><th>Management action</th><th>Rationale</th><th>Monitoring</th><th>Safety / cautions</th></tr></thead><tbody>{section.managementPlan.map((item,i)=><tr key={i}><th>{item.phase}</th><td>{item.intervention}</td><td>{item.rationale||"Not specified in the uploaded source."}</td><td>{item.monitoring||"Not specified in the uploaded source."}</td><td>{item.cautions||"Not specified in the uploaded source."}</td></tr>)}</tbody></table></div>
                    </section>}
                    {section.clinicalRelevance&&<div className="study-clinical-relevance"><strong>Clinical relevance</strong><p>{section.clinicalRelevance}</p></div>}
                    {!!section.highYieldPoints?.length&&<div className="study-high-yield"><strong>Exam points</strong><ul>{section.highYieldPoints.map((point,i)=><li key={i}>{point}</li>)}</ul></div>}
                  </div>
                </article>;
              })}
              </div>
            </details>
            {!!selectedMaterial.summary.examFocus&&<section className="study-summary-block study-exam-focus">
              <div className="eyebrow">EXAM REVISION</div><h3>High-yield knowledge to master</h3>
              {!!selectedMaterial.summary.examFocus.mustKnow?.length&&<div className="study-exam-subsection"><h4>Must-know knowledge</h4><ul>{selectedMaterial.summary.examFocus.mustKnow.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
              {!!selectedMaterial.summary.examFocus.likelyShortNotes?.length&&<div className="study-exam-subsection"><h4>{selectedMaterialIsGeneral?"Short-answer themes to prepare":"Short-note themes to prepare"}</h4><ul>{selectedMaterial.summary.examFocus.likelyShortNotes.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
              {!!selectedMaterial.summary.examFocus.clinicalApplications?.length&&<div className="study-exam-subsection"><h4>Clinical application</h4><ul>{selectedMaterial.summary.examFocus.clinicalApplications.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
              {!!selectedMaterial.summary.examFocus.vivaQuestions?.length&&<div className="study-exam-subsection"><h4>{selectedMaterialIsGeneral?"Oral / presentation practice":"Viva practice"}</h4>{selectedMaterial.summary.examFocus.vivaQuestions.map((item,index)=><details className="study-revision-question" key={index}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>}
            </section>}
            
            {!!selectedMaterial.summary.comparisonTables?.length&&<section className="study-summary-block"><h3>Comparison tables</h3>{selectedMaterial.summary.comparisonTables.map((table,index)=><div className="study-table-wrap" key={index}><strong>{table.title}</strong><table><thead><tr>{table.columns.map((column,i)=><th key={i}>{column}</th>)}</tr></thead><tbody>{table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>)}</section>}
            {!!selectedMaterial.summary.keyTerms?.length&&<section className="study-summary-block"><h3>Key terms</h3><div className="study-key-terms">{selectedMaterial.summary.keyTerms.map((item,index)=><div key={index}><strong>{item.term}</strong><p>{item.meaning}</p></div>)}</div></section>}
            {!!selectedMaterial.summary.flowcharts?.length&&<section className="study-summary-block study-flowcharts"><h3>Visual learning pathways</h3><p className="study-section-intro">Use these simplified sequences to connect the steps and understand how the process fits together.</p>{selectedMaterial.summary.flowcharts.map((flow,index)=><div className="study-flowchart" key={index}><strong>{flow.title}</strong><ol>{flow.steps.map((step,stepIndex)=><li key={stepIndex}><span>{String(stepIndex+1).padStart(2,"0")}</span><p>{step}</p></li>)}</ol>{flow.takeaway&&<p className="study-flowchart-takeaway"><b>Remember:</b> {flow.takeaway}</p>}</div>)}</section>}
            {!!recommendedVideoSuggestions.length&&<details className="study-summary-block study-video-resources">
              <summary className="study-video-disclosure"><div className="study-video-disclosure-heading"><span className="study-video-disclosure-brand" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z"/></svg></span><div><div className="eyebrow">OPTIONAL VIDEO SUPPORT</div><h3>One or two focused video recommendations</h3></div></div><p className="study-section-intro">The detailed notes are primary. Open this section when a visual explanation or an additional lecture would help.</p><span className="study-video-app-badge">1–2 resources</span></summary>

              <form className="study-video-search-form" onSubmit={event=>{event.preventDefault();void searchYouTube(youtubeQuery);}}>
                <label htmlFor="clerkme-youtube-search">Search for a lecture</label>
                <div className="study-video-search-controls"><input id="clerkme-youtube-search" value={youtubeQuery} onChange={event=>setYoutubeQuery(event.target.value)} placeholder="e.g. nephrotic syndrome pathophysiology" maxLength={120}/><button type="submit" disabled={youtubeLoading||!youtubeQuery.trim()}>{youtubeLoading?"Searching…":"Search videos"}</button></div>
                <small>Search results are limited to videos that allow embedding.</small>
              </form>

              <form className="study-video-link-form" onSubmit={event=>{event.preventDefault();playYouTubeLink();}}>
                <label htmlFor="clerkme-youtube-link">Already have a YouTube video link?</label>
                <div className="study-video-search-controls"><input id="clerkme-youtube-link" type="url" value={youtubeLink} onChange={event=>setYoutubeLink(event.target.value)} placeholder="Paste a YouTube video or Shorts link here"/><button type="submit" className="study-video-secondary-button">Play inside ClerkMe</button></div>
              </form>

              {!!youtubeError&&<p className="study-video-status" role="status">{youtubeError}</p>}



              {!!youtubeVideos.length&&<div className="study-video-results"><div className="study-video-results-heading"><strong>Recommended YouTube videos</strong><span>{youtubeVideos.length} relevant results</span></div><div className="study-video-grid">{youtubeVideos.slice(0,4).map((video,index)=><button type="button" className={"study-video-result"+(activeYoutubeVideo?.id===video.id?" active":"")} key={video.id} onClick={()=>{setActiveYoutubeVideo(video);setYoutubeError("");}}><img src={video.thumbnailUrl} alt="" loading="lazy"/><span>{index===0&&<em className="study-video-best-match">TOP RECOMMENDATION</em>}<strong>{video.title}</strong><small>{video.channelTitle}</small><em>{video.description}</em></span><b className="study-video-youtube-small" aria-label="YouTube">▶</b></button>)}</div></div>}

              <div className="study-video-recommendations"><div className="study-video-results-heading"><strong>Recommended videos from your lecture</strong><span>{recommendedVideoSuggestions.length}</span></div><div className="study-video-grid">{recommendedVideoSuggestions.map((video,index)=><article className="study-video-link" key={index}><div className="study-video-youtube-mark" aria-label="YouTube"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z"/></svg><b>YouTube</b></div><span><strong>{video.topic}</strong><small>{video.channel}</small>{video.whyWatch&&<p>{video.whyWatch}</p>}<button type="button" className="study-video-topic-button" disabled={youtubeLoading} onClick={()=>void searchYouTube(video.topic+" "+video.channel+(selectedMaterialIsGeneral?" lecture":" medical lecture"),true)}>{youtubeLoading&&youtubeQuery===video.topic+" "+video.channel+(selectedMaterialIsGeneral?" lecture":" medical lecture")?"Finding a playable lecture…":"Watch this YouTube lecture"}</button></span></article>)}</div></div>

              {activeYoutubeVideo&&<div className="study-video-player-panel" ref={youtubePlayerRef} tabIndex={-1}>
                <div className="study-video-player-heading"><div><span className="eyebrow">NOW PLAYING IN CLERKME</span><strong>{activeYoutubeVideo.title}</strong><small>{activeYoutubeVideo.channelTitle}</small></div><button type="button" onClick={()=>setActiveYoutubeVideo(null)} aria-label="Close video player">Close player ×</button></div>
                <div className="study-video-player-frame"><iframe src={"https://www.youtube-nocookie.com/embed/"+activeYoutubeVideo.id+"?rel=0&playsinline=1"} title={activeYoutubeVideo.title+" — YouTube video player"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen loading="lazy"/></div>
                <p className="study-video-player-note">Video playback is provided by YouTube. Some videos may still be unavailable here because of age restrictions or the uploader’s embedding settings.</p>
                <div className="study-video-save-actions">
                  <button type="button" className="study-video-save-button" onClick={()=>void saveActiveYoutubeVideo()} disabled={videoSaving||!activeYoutubeVideo||savedYoutubeVideoIds.includes(activeYoutubeVideo.id)}>
                    {videoSaving?"Saving lecture…":activeYoutubeVideo&&savedYoutubeVideoIds.includes(activeYoutubeVideo.id)?"✓ Saved to your library":"＋ Save to my video library"}
                  </button>
                  <span>Collection: {unitName(selectedMaterial.unit)}</span>
                </div>
                {!!videoSaveNotice&&<p className="study-video-save-notice" role="status">{videoSaveNotice}</p>}
                {!!videoSaveError&&<p className="study-video-save-error" role="alert">{videoSaveError}</p>}
              </div>}
            </details>}
            {!!selectedMaterial.summary.mnemonics?.length&&<section className="study-summary-block study-mnemonics">
              <div className="eyebrow">MEMORY TOOLS</div><h3>Mnemonics worth remembering</h3>
              <p className="study-section-intro">Understand the concept first, then use these accurate recall aids to retrieve the important details.</p>
              <div className="study-mnemonic-grid">{selectedMaterial.summary.mnemonics.map((item,index)=><article className="study-mnemonic-card" key={index}>
                <span className="study-mnemonic-label">MNEMONIC {String(index+1).padStart(2,"0")}</span>
                <h4>{item.title}</h4><strong className="study-mnemonic-word">{item.mnemonic}</strong>
                <ol>{item.expansion.map((part,partIndex)=><li key={partIndex}>{part}</li>)}</ol>
                {item.whyItWorks&&<p>{item.whyItWorks}</p>}
                {item.caution&&<small>{item.caution}</small>}
              </article>)}</div>
            </section>}
            {!!selectedMaterial.summary.memoryAids?.length&&<section className="study-summary-block"><h3>Memory aids</h3><ul>{selectedMaterial.summary.memoryAids.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            {!!selectedMaterial.summary.commonPitfalls?.length&&<section className="study-summary-block study-summary-warnings"><h3>Common pitfalls</h3><ul>{selectedMaterial.summary.commonPitfalls.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            {!!selectedMaterial.summary.revisionQuestions?.length&&<section className="study-summary-block"><h3>Quick revision questions</h3>{selectedMaterial.summary.revisionQuestions.map((item,index)=><details className="study-revision-question" key={index}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>}
            {!!selectedMaterial.summary.unclearOrMissing?.length&&<section className="study-summary-block study-summary-warnings"><h3>Topics to verify or supplement</h3><ul>{selectedMaterial.summary.unclearOrMissing.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            {!!selectedMaterial.summary.sourceCoverage?.length&&<section className="study-summary-block"><h3>Topics covered from your source</h3><ul>{selectedMaterial.summary.sourceCoverage.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
            <p className="study-summary-disclaimer">{selectedMaterial.summary.disclaimer}</p>
          </div> : <div className="materials-empty"><span>•</span><strong>No study guide has been prepared</strong><p>ClerkMe will build a detailed, source-based revision resource with mechanisms, clinical relevance, exam facts, comparisons and key explanations—not just a short summary.</p><button className="primary-button" onClick={()=>summarise(selectedMaterial.id)} disabled={working||selectedMaterial.hasExtractableText===false}>{summaryWorking?"Building your study guide…":"Create study guide →"}</button></div>}
        </>}



        {tab==="questions" && <div className="study-mcq-panel">
          {questionGenerationStatus[selectedMaterial.id]==="generating"&&<div className="study-quick-preview-banner" role="status"><span className="study-preview-dot" aria-hidden="true"/><div><strong>Building your SBA question set</strong><p>ClerkMe is generating source-specific questions alongside your detailed Study Guide. This tab will update automatically when the new questions are saved.</p></div></div>}
          {questionGenerationStatus[selectedMaterial.id]==="failed"&&<div className="study-summary-warnings" role="status"><strong>SBA generation needs another attempt</strong><p>{questionGenerationErrors[selectedMaterial.id]||"ClerkMe could not complete the new question set. Your uploaded source and any questions already saved remain available."}</p><button type="button" className="secondary-button" onClick={generateQuestions} disabled={working||selectedMaterial.hasExtractableText===false}>Retry SBA generation</button></div>}
          {activeQuestions.length>0 ? <>
            <div className="study-mcq-heading">
              <div><div className="eyebrow">{selectedMaterialIsGeneral?"SOURCE-SPECIFIC PRACTICE":"SOURCE-SPECIFIC EXAM PRACTICE"}</div><h3>{selectedMaterial.title}: {selectedMaterialIsGeneral?"Practice questions":"SBA practice"}</h3><p>{selectedMaterialIsGeneral?"Subject-appropriate single-best-answer questions with five options (A–E), source-based scenarios where useful, and explanations for every option. Choose Practice for immediate feedback or Live test for a timed assessment.":"USMLE-style single-best-answer questions with five options (A-E), clinically framed stems where appropriate, and explanations for every option. Choose Practice for immediate feedback or Live test for a timed examination simulation."}</p></div>
              <div className="study-mcq-heading-actions"><button type="button" className="text-link" onClick={()=>setTab("summary")} disabled={liveInProgress}>← Read study guide</button></div>
            </div>

            <div className="study-mcq-mode-switch" role="group" aria-label="Choose MCQ mode">
              <button type="button" className={quizMode==="practice"?"active":""} aria-pressed={quizMode==="practice"} disabled={liveInProgress} onClick={()=>switchQuizMode("practice")}><strong>Practice</strong><span>Instant feedback after each answer</span></button>
              <button type="button" className={quizMode==="live"?"active":""} aria-pressed={quizMode==="live"} disabled={liveInProgress} onClick={()=>switchQuizMode("live")}><strong>Live test</strong><span>Timed · answers revealed at the end</span></button>
            </div>

            {quizMode==="live" && liveDeadline===null && !quizFinished && <section className="study-live-setup">
              <div className="eyebrow">EXAM SIMULATION SETTINGS</div>
              <h3>Set your time before you begin</h3>
              <p>This is the total time for the entire question set, not time per question. You can move between questions and change your selected answers until you submit or the timer reaches zero. The clock continues if you move to another ClerkMe section and return.</p>
              <div className="study-live-setup-fields">
                <label>Total time allowed
                  <select value={durationChoice} onChange={event=>setDurationChoice(event.target.value)}>
                    <option value="5">5 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="20">20 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">120 minutes</option>
                    <option value="custom">Custom time</option>
                  </select>
                </label>
                {durationChoice==="custom" && <label>Custom time (5–180 minutes)
                  <input type="number" min={5} max={180} step={5} value={customDuration} onChange={event=>setCustomDuration(event.target.value)}/>
                </label>}
              </div>
              <div className="study-live-setup-summary"><span>{activeQuestions.length} questions</span><b>·</b><span>{liveDurationMinutes} minutes total</span><b>·</b><span>Feedback at the end</span></div>
              <div className="study-live-setup-actions"><button type="button" className="primary-button" onClick={startLiveTest}>Start live test <span>→</span></button><span>The timer starts only when you press Start.</span></div>
            </section>}

            {(quizMode==="practice" || liveInProgress || quizFinished) && <>
              {quizMode==="live" && liveInProgress && <section className={"study-live-timer "+(timerUrgency?"is-"+timerUrgency:"")} aria-live="polite">
                <div className="study-live-timer-top"><div><span>TIME REMAINING</span><strong>{formatTimer(remainingSeconds)}</strong></div><span className="study-live-timer-note">Your answers are not marked until you submit.</span></div>
                <div className="study-live-timer-track"><span style={{width:Math.max(0,Math.min(100,(remainingSeconds/liveDurationSeconds)*100))+"%"}}/></div>
                {remainingSeconds<=300 && <p>{remainingSeconds<=60?"One minute or less remaining. Review your unanswered questions.":"Five minutes or less remaining. Check your progress and unanswered questions."}</p>}
              </section>}

              <div className="study-mcq-stats">
                <div><span>Question set</span><strong>{activeQuestions.length}</strong></div>
                <div><span>Answered</span><strong>{answeredCount}/{activeQuestions.length}</strong></div>
                {quizMode==="live" && !quizFinished
                  ? <div><span>Unanswered</span><strong>{activeQuestions.length-answeredCount}</strong></div>
                  : <div><span>Correct</span><strong>{correctCount}</strong></div>}
              </div>

              {quizFinished ? <section className="study-mcq-results">
                <div className="eyebrow">{quizMode==="live"?"LIVE TEST RESULTS":"PRACTICE COMPLETE"}</div>
                <div className="study-mcq-result-score">{scorePercent}<span>%</span></div>
                <h3>{correctCount} correct out of {activeQuestions.length}</h3>
                {quizMode==="live" ? <div className="study-live-result-time"><span>Time allowed <strong>{formatTimer(liveDurationSeconds)}</strong></span><span>Time used <strong>{formatTimer(liveElapsedSeconds)}</strong></span></div> : null}
                <p>{quizMode==="live"
                  ? liveTimedOut
                    ? "Time expired and your answers were submitted automatically. Review every explanation below."
                    : "Your live test has been submitted. Your answers and explanations are now available for review."
                  : "You answered "+answeredCount+" of "+activeQuestions.length+" questions. Review the explanations below, revisit the study guide, or try the set again."}</p>
                <div className="study-mcq-result-actions">
                  <button type="button" className="primary-button" onClick={()=>{setQuestionIndex(0);setQuestionAnswers({});setQuizFinished(false);setLiveDeadline(null);setLiveStartedAt(null);setLiveElapsedSeconds(0);setLiveTimedOut(false);if(quizMode==="live")setRemainingSeconds(liveDurationMinutes*60);}}>Try again</button>
                  <button type="button" className="secondary-button" onClick={()=>setTab("summary")}>Return to Study Guide</button>
                  {quizMode==="live"&&<button type="button" className="text-link" onClick={()=>switchQuizMode("practice")}>Switch to practice</button>}
                </div>
                <div className="study-mcq-review-list"><h4>Answer review and explanations</h4>{activeQuestions.map((item,index)=><details key={index} className="study-mcq-review-item"><summary><span>Q{index+1}</span>{item.question}<b className={questionAnswers[index]===item.answerIndex?"review-correct":questionAnswers[index]===undefined?"review-unanswered":"review-wrong"}>{questionAnswers[index]===undefined?"Not answered":questionAnswers[index]===item.answerIndex?"Correct":"Incorrect"}</b></summary><p><strong>Your answer:</strong> {questionAnswers[index]===undefined?"Not answered":item.options[questionAnswers[index]]}</p><p><strong>Best answer:</strong> {item.options[item.answerIndex]}</p><p><strong>Explanation:</strong> {item.explanation}</p>{item.optionRationales?.length===5&&<div className="study-mcq-option-rationales"><strong>Option-by-option analysis</strong><ol>{item.optionRationales.map((rationale,optionIndex)=><li key={optionIndex}><b>{String.fromCharCode(65+optionIndex)}. {item.options[optionIndex]}</b><span>{rationale}</span></li>)}</ol></div>}</details>)}</div>
              </section> : currentQuestion && <>
                <div className="study-mcq-progress-row"><span>QUESTION {questionIndex+1} OF {activeQuestions.length}</span><span>{currentQuestion.topic} · {currentQuestion.difficulty}</span></div>
                <div className="study-mcq-progress"><span style={{width:((questionIndex+1)/activeQuestions.length*100)+"%"}}/></div>
                <article className="study-mcq-question-card">
                  <span className="study-mcq-question-label">{quizMode==="live"?"LIVE TEST · SINGLE BEST ANSWER":"PRACTICE · SINGLE BEST ANSWER"}</span>
                  <h3>{currentQuestion.question}</h3>
                  <div className="study-mcq-options">{currentQuestion.options.map((option,optionIndex)=>{
                    const selectedOption = currentAnswer===optionIndex;
                    const optionClass = quizMode==="live"
                      ? (selectedOption?" is-selected":"")
                      : (currentAnswer===null?"":optionIndex===currentQuestion.answerIndex?" is-correct":selectedOption?" is-wrong":" is-muted");
                    return <button key={optionIndex} type="button" disabled={quizMode==="practice"&&currentAnswer!==null} aria-pressed={selectedOption} className={"study-mcq-option"+optionClass} onClick={()=>{
                      setQuestionAnswers(previous=>({...previous,[questionIndex]:optionIndex}));
                      fetch("/api/activity",{method:"POST",credentials:"same-origin"}).catch(()=>{});
                      if(quizMode==="live"){
                        let nextUnanswered=-1;
                        for(let offset=1;offset<activeQuestions.length;offset++){
                          const candidate=(questionIndex+offset)%activeQuestions.length;
                          if(questionAnswers[candidate]===undefined){nextUnanswered=candidate;break;}
                        }
                        if(nextUnanswered>=0) setQuestionIndex(nextUnanswered);
                        else finishLiveTest(false);
                      }
                    }}><span>{String.fromCharCode(65+optionIndex)}</span><b>{option}</b><i>{quizMode==="live"?(selectedOption?"●":""):(currentAnswer!==null&&optionIndex===currentQuestion.answerIndex?"✓":selectedOption?"×":"")}</i></button>;
                  })}</div>
                  {quizMode==="practice"&&currentAnswer!==null&&<div className={"study-mcq-feedback"+(currentAnswer===currentQuestion.answerIndex?" is-correct":" is-wrong")} role="status"><strong>{currentAnswer===currentQuestion.answerIndex?"Correct — well done.":"Not quite. Review this concept."}</strong><p><b>Best answer: {currentQuestion.options[currentQuestion.answerIndex]}.</b> {currentQuestion.explanation}</p>{currentQuestion.optionRationales?.length===5&&<div className="study-mcq-option-rationales"><strong>Option-by-option analysis</strong><ol>{currentQuestion.optionRationales.map((rationale,optionIndex)=><li key={optionIndex}><b>{String.fromCharCode(65+optionIndex)}. {currentQuestion.options[optionIndex]}</b><span>{rationale}</span></li>)}</ol></div>}</div>}
                  {quizMode==="live"&&<p className="study-live-answer-note">{currentAnswer===null?"Choose one answer. You can change it before submitting.":"Answer selected. You can change it at any time before submission."}</p>}
                  <div className="study-mcq-navigation">
                    <button type="button" className="secondary-button" disabled={questionIndex===0} onClick={()=>setQuestionIndex(index=>index-1)}>← Previous</button>
                    <span>{quizMode==="live"?answeredCount+" of "+activeQuestions.length+" answered":currentAnswer===null?"Choose one answer to see the explanation.":"Answer recorded for this practice question."}</span>
                    {quizMode==="live"
                      ? questionIndex===activeQuestions.length-1
                        ? <button type="button" className="primary-button" onClick={()=>{const unanswered=activeQuestions.length-answeredCount;if(unanswered>0&&!window.confirm("You have "+unanswered+" unanswered question(s). Submit your test now?"))return;finishLiveTest(false);}}>Submit live test</button>
                        : <button type="button" className="primary-button" onClick={()=>setQuestionIndex(index=>index+1)}>Next question →</button>
                      : <button type="button" className="primary-button" disabled={currentAnswer===null} onClick={()=>questionIndex===activeQuestions.length-1?setQuizFinished(true):setQuestionIndex(index=>index+1)}>{questionIndex===activeQuestions.length-1?"Finish practice":"Next question →"}</button>}
                  </div>
                </article>
                <div className="study-mcq-question-map"><strong>Jump to a question</strong><div>{activeQuestions.map((item,index)=><button type="button" key={index} aria-label={"Go to question "+(index+1)} aria-current={questionIndex===index?"step":undefined} className={(questionIndex===index?"is-current ":"")+(questionAnswers[index]!==undefined?"is-answered":"")} onClick={()=>setQuestionIndex(index)}>{index+1}</button>)}</div></div>
                {quizMode==="practice"
                  ? <button type="button" className="study-mcq-finish-link" onClick={()=>setQuizFinished(true)}>Finish and review this attempt</button>
                  : <button type="button" className="study-mcq-finish-link" onClick={()=>{const unanswered=activeQuestions.length-answeredCount;if(unanswered>0&&!window.confirm("You have "+unanswered+" unanswered question(s). Submit your test now?"))return;finishLiveTest(false);}}>Submit live test and reveal feedback</button>}
              </>}
            </>}
          </> : questionGenerationStatus[selectedMaterial.id]==="generating"
            ? <div className="materials-empty"><span>✎</span><strong>Your SBA questions are being generated</strong><p>The question writer is working from your original lecture while the detailed guide is being built. You do not need to start a second generation request.</p></div>
            : <div className="materials-empty"><span>✎</span><strong>No MCQs generated for this material yet</strong><p>ClerkMe will create source-specific, non-repeating five-option SBA questions. You can choose the number and difficulty for additional questions at any time.</p><button type="button" className="primary-button" onClick={generateQuestions} disabled={working||selectedMaterial.hasExtractableText===false}>{questionsWorking?"Generating questions…":"Generate MCQs now →"}</button></div>}
        </div>}

        {tab==="ask" && <div className="study-tutor-panel">
          <div className="study-tutor-intro"><div className="eyebrow">SOURCE-GROUNDED STUDY SUPPORT</div><h3>Ask questions about {selectedMaterial.title}</h3><p>ClerkMe will use this material first, explain the answer and identify where the source supports it. It will tell you when the document does not contain enough information.</p></div>
          <label className="study-question-input">Your question
            <textarea rows={3} value={question} onChange={event=>{setQuestion(event.target.value);setAnswer(null);}} placeholder={libraryMode==="general"?"e.g. Explain the key ideas in this topic using the lecture…":"e.g. Explain the pathophysiology of left ventricular failure using this lecture…"}/>
          </label>
          <button className="primary-button" onClick={ask} disabled={answering||question.trim().length<5}>{answering?"Finding an answer in your material…":"Ask ClerkMe"} <span>→</span></button>
          {answer && <div className="study-tutor-answer">
            <div className="eyebrow">CLERKME EXPLANATION</div><p className="study-answer-main">{answer.answer}</p>
            {!!answer.keyPoints?.length&&<div className="study-summary-block"><h4>Key points</h4><ul>{answer.keyPoints.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
            {answer.clinicalReasoning&&<div className="study-clinical-relevance"><strong>{libraryMode==="general"?"How to think it through":"Clinical reasoning"}</strong><p>{answer.clinicalReasoning}</p></div>}
            {!!answer.sourceSupport?.length&&<div className="study-summary-block"><h4>Support from your source</h4>{answer.sourceSupport.map((item,index)=><div className="study-source-support" key={index}><strong>{item.locator||"Relevant source section"}</strong><p>{item.support}</p></div>)}</div>}
            {answer.supplementaryContext&&<div className="study-supplementary"><strong>Additional explanation</strong><p>{answer.supplementaryContext}</p></div>}
            {!!answer.limitations?.length&&<div className="study-summary-warnings"><strong>Limitations / points to verify</strong><ul>{answer.limitations.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
            {!!answer.followUpQuestions?.length&&<div className="study-summary-block"><h4>Test your understanding</h4><ul>{answer.followUpQuestions.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
          </div>}
        </div>}
      </section>}
      {!selectedMaterial && materials.length>0 && <p className="learning-note">Select a resource to study its Study Guide, ask questions or generate a unit-specific question set.</p>}
    </div>
  );
}
