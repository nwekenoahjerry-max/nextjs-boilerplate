"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { extractStudyFile, STUDY_FILE_ACCEPT, STUDY_FILE_TYPES } from "../lib/file-text";
import "./ask-clerkme.css";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  attachmentName?: string;
};
type ChatThread = { id: string; title: string; updatedAt: number; messages: ChatMessage[] };
type SourceMaterial = { id: string; title: string; unit?: string };
type VoiceStatus = "idle" | "connecting" | "connected";
type VoiceMode = "tutor" | "viva";
type Attachment = { name: string; text: string; characters: number };
type SpeechResult = { transcript: string };
type SpeechResultEvent = { resultIndex: number; results: ArrayLike<ArrayLike<SpeechResult>> };
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
};

const storageKey = (userKey: string) => "clerkme:ask-threads:v1:" + userKey;
const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : "ask-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
const stamp = () => Date.now();

function newThread(): ChatThread {
  return { id: makeId(), title: "New conversation", updatedAt: stamp(), messages: [] };
}

function resampleTo16k(input: Float32Array, inputRate: number): Int16Array {
  if (!input.length || !Number.isFinite(inputRate) || inputRate <= 0) return new Int16Array(0);
  const ratio = inputRate / 16000;
  const output = new Int16Array(Math.max(1, Math.floor(input.length / ratio)));
  for (let i = 0; i < output.length; i++) {
    const position = i * ratio;
    const left = Math.min(input.length - 1, Math.floor(position));
    const right = Math.min(input.length - 1, left + 1);
    const fraction = position - left;
    const sample = Math.max(-1, Math.min(1, input[left] * (1 - fraction) + input[right] * fraction));
    output[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return output;
}

function pcmToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000)));
  }
  return window.btoa(binary);
}

function base64ToPcm(value: string): Int16Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length - (binary.length % 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

function appendTranscript(current: string, next: string): string {
  const value = next.trim();
  if (!value) return current;
  if (!current.trim()) return value;
  return current.trimEnd() + " " + value;
}

function formatClock(seconds: number) {
  return Math.floor(seconds / 60).toString().padStart(2, "0") + ":" + (seconds % 60).toString().padStart(2, "0");
}

const mathSymbols: Record<string, string> = {
  "\\mu": "μ", "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ",
  "\\Delta": "Δ", "\\theta": "θ", "\\lambda": "λ", "\\pi": "π", "\sigma": "σ",
  "\\omega": "ω", "\\Omega": "Ω", "\\times": "×", "\\cdot": "·", "\\pm": "±",
  "\\leq": "≤", "\\le": "≤", "\\geq": "≥", "\\ge": "≥", "\\neq": "≠",
  "\\approx": "≈", "\\rightarrow": "→", "\\to": "→", "\\infty": "∞",
  "\\degree": "°", "\\circ": "°"
};
const superscriptChars: Record<string, string> = {
  "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹",
  "+":"⁺","-":"⁻","=":"⁼","(":"⁽",")":"⁾","n":"ⁿ","i":"ⁱ"
};
const subscriptChars: Record<string, string> = {
  "0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉",
  "+":"₊","-":"₋","=":"₌","(":"₍",")":"₎","a":"ₐ","e":"ₑ","h":"ₕ","i":"ᵢ",
  "j":"ⱼ","k":"ₖ","l":"ₗ","m":"ₘ","n":"ₙ","o":"ₒ","p":"ₚ","r":"ᵣ","s":"ₛ","t":"ₜ","u":"ᵤ","v":"ᵥ","x":"ₓ"
};

function formatMath(source: string): string {
  let value = source.trim()
    .replace(/\\(?:left|right|displaystyle|textstyle|scriptstyle)\b/g, "")
    .replace(/\\(?:text|mathrm|textrm|operatorname)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\\\s*/g, " ")
    .replace(/\\(?:,|;|:|!|quad|qquad|enspace|thinspace)/g, " ");
  for (const [command, symbol] of Object.entries(mathSymbols)) value = value.split(command).join(symbol);
  value = value
    .replace(/\\(?:mathbf|mathit|mathsf|mathtt)\b/g, "")
    .replace(/[{}]/g, "")
    .replace(/\\([#$%&_])/g, "$1")
    .replace(/\\([A-Za-z]+)/g, "$1");
  value = value.replace(/\^\{([^{}]+)\}|\^([A-Za-z0-9+=()-])/g, (_match, group: string | undefined, single: string | undefined) =>
    [...(group || single || "")].map(char => superscriptChars[char] || char).join("")
  );
  value = value.replace(/_\{([^{}]+)\}|_([A-Za-z0-9+=()-])/g, (_match, group: string | undefined, single: string | undefined) =>
    [...(group || single || "")].map(char => subscriptChars[char] || char).join("")
  );
  return value.replace(/\s+/g, " ").trim();
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.replace(/\\\|/g, "\u0000").split("|").map(cell => cell.replace(/\u0000/g, "|").trim());
}

function isMarkdownTableSeparator(line: string): boolean {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

function renderInline(value: string): ReactNode[] {
  const tokens = value.split(/(!\[[^\]]*\]\([^\s)]+\)|\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|\*\*[^*]+\*\*|\u0060[^\u0060]+\u0060|\*[^*]+\*)/g).filter(Boolean);
  return tokens.map((part, index) => {
    const image = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      const [, alt, src] = image;
      // Only render ClerkME's authenticated image endpoint. Never fetch arbitrary
      // model-supplied URLs from inside a conversation.
      const safeImage = /^\/api\/learning\/ask-image\?id=[0-9a-f-]{36}$/i.test(src);
      if (!safeImage) return alt || "";
      return (
        <span className="ask-generated-visual" key={index}>
          <img src={src} alt={alt || "AI-generated educational illustration"} loading="lazy" decoding="async"/>
          <small>AI-generated study illustration · check details against trusted learning resources</small>
        </span>
      );
    }
    const isMath = (part.charAt(0) === "$" && part.endsWith("$")) ||
      (part.startsWith("\\(") && part.endsWith("\\)")) ||
      (part.startsWith("\\[") && part.endsWith("\\]"));
    if (isMath) {
      const display = (part.charAt(0) === "$" && part.charAt(1) === "$") || part.startsWith("\\[");
      const inner = display && part.charAt(0) === "$" ? part.slice(2, -2)
        : part.charAt(0) === "$" ? part.slice(1, -1) : part.slice(2, -2);
      return <span key={index} className={display ? "ask-math ask-math-display" : "ask-math"} aria-label={inner}>{formatMath(inner)}</span>;
    }
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{renderInline(part.slice(2, -2))}</strong>;
    const backtick = String.fromCharCode(96);
    if (part.startsWith(backtick) && part.endsWith(backtick)) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{renderInline(part.slice(1, -1))}</em>;
    return part;
  });
}
function FormattedAnswer({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let codeLines: string[] | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={blocks.length}>{renderInline(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length || !listType) return;
    const items = list.map((item, index) => <li key={index}>{renderInline(item)}</li>);
    blocks.push(listType === "ol" ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = [];
    listType = null;
  };
  const flushCode = () => {
    if (!codeLines) return;
    blocks.push(<pre key={blocks.length}><code>{codeLines.join("\n")}</code></pre>);
    codeLines = null;
  };
  const addTable = (header: string[], rows: string[][]) => {
    const width = header.length;
    const fit = (row: string[]) => Array.from({ length: width }, (_unused, index) => row[index] || "");
    blocks.push(
      <div className="ask-table-wrap" key={blocks.length} role="region" aria-label="Comparison table" tabIndex={0}>
        <table className="ask-response-table">
          <thead><tr>{header.map((cell, index) => <th scope="col" key={index}>{renderInline(cell)}</th>)}</tr></thead>
          <tbody>{rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{fit(row).map((cell, cellIndex) => <td key={cellIndex}>{renderInline(cell)}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    );
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim().startsWith(String.fromCharCode(96).repeat(3))) {
      flushParagraph(); flushList();
      if (codeLines) flushCode(); else codeLines = [];
      continue;
    }
    if (codeLines) { codeLines.push(line); continue; }
    if (!line.trim()) { flushParagraph(); flushList(); continue; }

    // A Markdown table is identified by a header row followed by a separator row.
    if (line.includes("|") && index + 1 < lines.length && isMarkdownTableSeparator(lines[index + 1])) {
      flushParagraph(); flushList();
      const header = splitMarkdownTableRow(line);
      index++;
      const rows: string[][] = [];
      while (index + 1 < lines.length && lines[index + 1].trim() && lines[index + 1].includes("|")) {
        rows.push(splitMarkdownTableRow(lines[index + 1]));
        index++;
      }
      addTable(header, rows);
      continue;
    }

    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      blocks.push(<h3 key={blocks.length}>{renderInline(heading[1])}</h3>);
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(line)) { flushParagraph(); flushList(); continue; }
    const unordered = line.match(/^\s*[-*•]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const type = unordered ? "ul" : "ol";
      if (listType && listType !== type) flushList();
      listType = type;
      list.push((unordered || ordered)![1]);
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph(); flushList();
      blocks.push(<blockquote key={blocks.length}>{renderInline(quote[1])}</blockquote>);
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph(); flushList(); flushCode();
  return <div className="ask-formatted-answer">{blocks}</div>;
}
type AskIconName =
  | "sparkles" | "menu" | "plus" | "x" | "paperclip" | "folder" | "mic"
  | "headphones" | "clipboard-check" | "layers" | "arrow-up" | "message"
  | "file" | "shield-check" | "clock" | "chevron-right" | "trash" | "mic-off";

function AskIcon({ name, size = 16, strokeWidth = 1.9 }: { name: AskIconName; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {name === "sparkles" && <>
        <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>
        <path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z"/>
        <path d="m5 2 .7 1.6L7.5 4.5l-1.8.7L5 7l-.7-1.8-1.8-.7 1.8-.9L5 2Z"/>
      </>}
      {name === "menu" && <><path d="M4 6h16M4 12h16M4 18h16"/></>}
      {name === "plus" && <><path d="M12 5v14M5 12h14"/></>}
      {name === "x" && <><path d="m18 6-12 12M6 6l12 12"/></>}
      {name === "paperclip" && <path d="m8 12.5 6.2-6.2a3.2 3.2 0 0 1 4.5 4.5l-8.5 8.5a5 5 0 0 1-7.1-7.1l8.1-8.1"/>}
      {name === "folder" && <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z"/>}
      {name === "mic" && <><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M9 21.5h6"/></>}
      {name === "mic-off" && <><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 11.1 4.6M12 18v3.5M9 21.5h6M3 3l18 18"/></>}
      {name === "headphones" && <><path d="M3 13v-1a9 9 0 0 1 18 0v1"/><rect x="3" y="12" width="4" height="7" rx="2"/><rect x="17" y="12" width="4" height="7" rx="2"/><path d="M17 20a5 5 0 0 1-5 2"/></>}
      {name === "clipboard-check" && <><rect x="5" y="4.5" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 13l2.2 2.2 4.8-4.8"/></>}
      {name === "layers" && <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>}
      {name === "arrow-up" && <><path d="M12 19V5M6 11l6-6 6 6"/></>}
      {name === "message" && <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4h2A7.5 7.5 0 0 1 20 11.5Z"/><path d="M8 11h8M8 14h5"/></>}
      {name === "file" && <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M13 2v7h7"/></>}
      {name === "shield-check" && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>}
      {name === "clock" && <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}
      {name === "chevron-right" && <path d="m9 18 6-6-6-6"/>}
      {name === "trash" && <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></>}
    </svg>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  return (
    <article className={"ask-message-row " + (message.role === "user" ? "is-user" : "is-assistant")}>
      {message.role === "assistant" && <span className="ask-message-avatar ask-message-avatar-brand" aria-label="ClerkME"><img src="/clerkme-mark-navy.svg" alt="" width="26" height="26" decoding="async"/></span>}
      <div className="ask-message-bubble">
        {message.attachmentName && <div className="ask-message-attachment"><AskIcon name="file" size={13}/> {message.attachmentName}</div>}
        <div className="ask-message-text">{message.role === "assistant" ? <FormattedAnswer content={message.content}/> : message.content}</div>
        <time>{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</time>
      </div>
    </article>
  );
}

export default function AskClerkMePanel({ userKey, userName = "" }: { userKey: string; userName?: string }) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materials, setMaterials] = useState<SourceMaterial[]>([]);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showHistoryMobile, setShowHistoryMobile] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("tutor");
  const [voiceReconnecting, setVoiceReconnecting] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const [voiceDiagnostics, setVoiceDiagnostics] = useState("");
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceElapsed, setVoiceElapsed] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [dictating, setDictating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const pendingAudioFramesRef = useRef<Int16Array[]>([]);
  const pendingAudioSamplesRef = useRef(0);
  const preRollFramesRef = useRef<Int16Array[]>([]);
  const preRollSamplesRef = useRef(0);
  const detectedSpeechSamplesRef = useRef(0);
  const liveRequestIdRef = useRef("");
  const silentGainRef = useRef<GainNode | null>(null);
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextPlaybackTimeRef = useRef(0);
  const setupReadyRef = useRef(false);
  const endingRef = useRef(false);
  const mutedRef = useRef(false);
  const callAttemptRef = useRef(0);
  const connectionTimeoutRef = useRef<number | null>(null);
  const studentTranscriptRef = useRef("");
  const assistantTranscriptRef = useRef("");
  const activeThreadIdRef = useRef("");
  const dictationRef = useRef<SpeechRecognitionLike | null>(null);
  const microphoneInputDetectedRef = useRef(false);
  const pendingSpeechTurnRef = useRef(false);
  const speechResponseTimerRef = useRef<number | null>(null);
  const speechActiveRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const microphoneNoiseFloorRef = useRef(0.002);
  const startedAtRef = useRef(0);
  const sessionHandleRef = useRef("");
  const liveTokenExpiresAtRef = useRef(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const assistantAudioReceivedRef = useRef(false);

  const activeThread = threads.find(thread => thread.id === activeThreadId) || null;
  const activeMessages = activeThread?.messages || [];
  const hasContext = Boolean(attachment || materialId);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(userKey));
      const parsed = raw ? JSON.parse(raw) : [];
      const saved = Array.isArray(parsed) ? parsed.filter((item: any) =>
        item && typeof item.id === "string" && Array.isArray(item.messages)
      ).slice(0, 12) as ChatThread[] : [];
      if (saved.length) {
        setThreads(saved);
        setActiveThreadId(saved[0].id);
      } else {
        const first = newThread();
        setThreads([first]);
        setActiveThreadId(first.id);
      }
    } catch {
      const first = newThread();
      setThreads([first]);
      setActiveThreadId(first.id);
      setNotice("Previous conversations could not be read from this browser. A new conversation is ready.");
    }
    setHydrated(true);
  }, [userKey]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const compact = threads.slice(0, 8).map(thread => ({
        ...thread,
        messages: thread.messages.slice(-24).map(message => ({
          ...message,
          content: message.content.slice(0, 6000)
        }))
      }));
      window.localStorage.setItem(storageKey(userKey), JSON.stringify(compact));
    } catch {
      setNotice("Your browser storage is nearly full. Older conversations may not be saved.");
    }
  }, [threads, hydrated, userKey]);

  useEffect(() => {
    fetch("/api/learning/materials", { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load your saved lectures.");
        setMaterials(Array.isArray(data.materials) ? data.materials : []);
      })
      .catch(() => setMaterials([]));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeMessages.length, sending]);

  useEffect(() => {
    if (voiceStatus !== "connected") return;
    const timer = window.setInterval(() => {
      setVoiceElapsed(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [voiceStatus]);

  const updateThread = (threadId: string, updater: (thread: ChatThread) => ChatThread) => {
    setThreads(current => current.map(thread => thread.id === threadId
      ? updater(thread)
      : thread
    ).sort((a, b) => b.updatedAt - a.updatedAt));
  };

  const createConversation = () => {
    const thread = newThread();
    setThreads(current => [thread, ...current].slice(0, 8));
    setActiveThreadId(thread.id);
    setAttachment(null);
    setMaterialId("");
    setMaterialTitle("");
    setDraft("");
    setNotice("");
    setShowHistoryMobile(false);
    setShowMaterials(false);
  };

  const selectConversation = (threadId: string) => {
    setActiveThreadId(threadId);
    setAttachment(null);
    setMaterialId("");
    setMaterialTitle("");
    setNotice("");
    setShowHistoryMobile(false);
    setShowMaterials(false);
  };

  const pickFile = async (file?: File) => {
    if (!file) return;
    setNotice("");
    setExtracting(true);
    try {
      const extracted = await extractStudyFile(file);
      const text = extracted.text.trim();
      if (text.length < 20) throw new Error("ClerkME could not find enough readable text in that file. Try a text-based PDF or clearer image.");
      setAttachment({ name: file.name, text: text.slice(0, 85000), characters: text.length });
      setMaterialId("");
      setMaterialTitle("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The file could not be read. Please try another file.");
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const selectMaterial = (material: SourceMaterial) => {
    setMaterialId(material.id);
    setMaterialTitle(material.title);
    setAttachment(null);
    setShowMaterials(false);
    setNotice("");
  };

  const appendMessages = (threadId: string, messages: ChatMessage[]) => {
    if (!messages.length) return;
    updateThread(threadId, thread => ({
      ...thread,
      title: thread.messages.length === 0
        ? (messages.find(message => message.role === "user")?.content.slice(0, 48) || "New conversation")
        : thread.title,
      updatedAt: stamp(),
      messages: [...thread.messages, ...messages].slice(-36)
    }));
  };

  const sendMessage = async (suggested?: string) => {
    const question = (suggested ?? draft).trim();
    if ((!question && !hasContext) || sending || extracting) return;
    const thread = activeThread || newThread();
    const threadId = thread.id;
    if (!activeThread) {
      setThreads(current => [thread, ...current]);
      setActiveThreadId(threadId);
    }
    const userMessage: ChatMessage = {
      id: makeId(), role: "user",
      content: question || "Please help me understand the attached learning material.",
      createdAt: stamp(),
      ...(attachment ? { attachmentName: attachment.name } : materialTitle ? { attachmentName: materialTitle } : {})
    };
    const prior = thread.messages || [];
    const history = [...prior, userMessage].slice(-18);
    setThreads(current => {
      const updated = current.some(item => item.id === threadId)
        ? current.map(item => item.id === threadId
          ? { ...item, title: item.messages.length ? item.title : userMessage.content.slice(0, 48), updatedAt: stamp(), messages: [...item.messages, userMessage].slice(-36) }
          : item)
        : [{ ...thread, title: userMessage.content.slice(0, 48), updatedAt: stamp(), messages: [userMessage] }, ...current];
      return updated.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
    });
    setDraft("");
    setNotice("");
    setSending(true);
    try {
      const response = await fetch("/api/learning/assistant", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          history: history.slice(0, -1).map(message => ({ role: message.role, content: message.content })),
          attachmentText: attachment?.text || "",
          sourceName: attachment?.name || materialTitle || "",
          materialId
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.answer !== "string") throw new Error(data.error || "ClerkME could not complete that answer.");
      appendMessages(threadId, [{ id: makeId(), role: "assistant", content: data.answer, createdAt: stamp() }]);
    } catch (error) {
      updateThread(threadId, current => {
        const messages = current.messages.filter(message => message.id !== userMessage.id);
        return { ...current, title: messages.length ? current.title : "New conversation", updatedAt: stamp(), messages };
      });
      setDraft(question);
      setNotice(error instanceof Error ? error.message : "ClerkME could not complete that answer. Please retry.");
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  };

  const startDictation = () => {
    if (dictating) {
      dictationRef.current?.stop();
      dictationRef.current = null;
      setDictating(false);
      return;
    }
    const browser = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) {
      setNotice("Voice typing is not supported by this browser. You can still use the live voice conversation or type your question.");
      return;
    }
    try {
      const recognition = new Constructor();
      recognition.lang = "en-GB";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = event => {
        const spoken = Array.from(event.results).slice(event.resultIndex).map(result => result[0]?.transcript || "").join(" ").trim();
        if (spoken) setDraft(current => (current ? current.trimEnd() + " " : "") + spoken);
      };
      recognition.onerror = event => {
        setNotice(event.error === "not-allowed"
          ? "Microphone access was denied. Allow microphone access in your browser settings."
          : "Voice typing stopped. You can continue typing your question.");
        setDictating(false);
        dictationRef.current = null;
      };
      recognition.onend = () => {
        setDictating(false);
        dictationRef.current = null;
      };
      dictationRef.current = recognition;
      recognition.start();
      setDictating(true);
      setNotice("Listening for your words. Tap the microphone again when you are finished.");
    } catch {
      setNotice("Voice typing could not start. Check your browser microphone permission.");
      setDictating(false);
    }
  };

  const clearConnectionTimeout = () => {
    if (connectionTimeoutRef.current !== null) {
      window.clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  };

  const clearSpeechResponseTimer = () => {
    if (speechResponseTimerRef.current !== null) {
      window.clearTimeout(speechResponseTimerRef.current);
      speechResponseTimerRef.current = null;
    }
  };

  const clearPlayback = () => {
    outputSourcesRef.current.forEach(source => { try { source.stop(); } catch {} });
    outputSourcesRef.current.clear();
    nextPlaybackTimeRef.current = 0;
  };

  const releaseVoiceMedia = () => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    silentGainRef.current?.disconnect();
    silentGainRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    clearPlayback();
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") void audioContext.close();
  };

  const commitVoiceTranscript = () => {
    const turns: ChatMessage[] = [];
    const student = studentTranscriptRef.current.trim();
    const assistant = assistantTranscriptRef.current.trim();
    studentTranscriptRef.current = "";
    assistantTranscriptRef.current = "";
    if (student) turns.push({ id: makeId(), role: "user", content: student, createdAt: stamp() });
    if (assistant) turns.push({ id: makeId(), role: "assistant", content: assistant, createdAt: stamp() });
    if (turns.length) appendMessages(activeThreadIdRef.current, turns);
    setVoiceTranscript("");
  };

  // Gemini Live accepts new user audio through realtimeInput. Audio is
  // streamed as short 40 ms PCM frames; clientContent is reserved for history.
  const flushPendingAudio = (socket: WebSocket, flushRemainder = false) => {
    while (
      socket.readyState === WebSocket.OPEN &&
      (pendingAudioSamplesRef.current >= 640 || (flushRemainder && pendingAudioSamplesRef.current > 0))
    ) {
      const packetLength = Math.min(640, pendingAudioSamplesRef.current);
      const packet = new Int16Array(packetLength);
      let written = 0;
      while (written < packetLength) {
        const first = pendingAudioFramesRef.current[0];
        if (!first?.length) {
          pendingAudioFramesRef.current.shift();
          continue;
        }
        const take = Math.min(first.length, packetLength - written);
        packet.set(first.subarray(0, take), written);
        if (take === first.length) pendingAudioFramesRef.current.shift();
        else pendingAudioFramesRef.current[0] = first.subarray(take);
        written += take;
      }
      pendingAudioSamplesRef.current -= packetLength;
      socket.send(JSON.stringify({
        realtimeInput: {
          audio: { data: pcmToBase64(packet), mimeType: "audio/pcm;rate=16000" }
        }
      }));
    }
  };

  const finishSpeechTurn = (socket: WebSocket) => {
    if (socket.readyState !== WebSocket.OPEN || !setupReadyRef.current || !speechActiveRef.current) return false;
    if (detectedSpeechSamplesRef.current < 800) {
      clearPendingAudio();
      speechActiveRef.current = false;
      lastSpeechAtRef.current = 0;
      pendingSpeechTurnRef.current = false;
      clearSpeechResponseTimer();
      return false;
    }

    try {
      flushPendingAudio(socket, true);
      socket.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
    } catch {
      clearPendingAudio();
      speechActiveRef.current = false;
      lastSpeechAtRef.current = 0;
      pendingSpeechTurnRef.current = false;
      clearSpeechResponseTimer();
      setVoiceNotice("The voice message could not be completed. Check your connection and try again.");
      return false;
    }

    clearPendingAudio();
    speechActiveRef.current = false;
    lastSpeechAtRef.current = 0;
    pendingSpeechTurnRef.current = true;
    setVoiceNotice("Processing your question…");
    setVoiceDiagnostics("Voice turn streamed and ended; waiting for Gemini's response.");
    clearSpeechResponseTimer();
    speechResponseTimerRef.current = window.setTimeout(() => {
      speechResponseTimerRef.current = null;
      if (!pendingSpeechTurnRef.current || !setupReadyRef.current || endingRef.current) return;
      pendingSpeechTurnRef.current = false;
      setVoiceDiagnostics("Gemini received the voice turn but no response event arrived.");
      setVoiceNotice("ClerkME has not received a reply yet. Please try speaking again or use text chat.");
    }, 20000);
    return true;
  };

  const clearPendingAudio = () => {
    pendingAudioFramesRef.current = [];
    pendingAudioSamplesRef.current = 0;
    preRollFramesRef.current = [];
    preRollSamplesRef.current = 0;
    detectedSpeechSamplesRef.current = 0;
  };

  const stopVoiceCall = (notify = true) => {
    callAttemptRef.current += 1;
    clearConnectionTimeout();
    clearSpeechResponseTimer();
    pendingSpeechTurnRef.current = false;
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    endingRef.current = true;
    const socket = socketRef.current;
    const wasSetupReady = setupReadyRef.current;
    setupReadyRef.current = false;
    // Finish an utterance already in progress before closing the socket.
    if (socket?.readyState === WebSocket.OPEN && wasSetupReady && speechActiveRef.current) {
      try {
        flushPendingAudio(socket, true);
        socket.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
      } catch {}
    }
    clearPendingAudio();
    speechActiveRef.current = false;
    lastSpeechAtRef.current = 0;
    socketRef.current = null;
    try { if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "Student ended voice session"); } catch {}
    releaseVoiceMedia();
    mutedRef.current = false;
    setVoiceMuted(false);
    commitVoiceTranscript();
    sessionHandleRef.current = "";
    liveTokenExpiresAtRef.current = 0;
    reconnectAttemptsRef.current = 0;
    setVoiceStatus("idle");
    setVoiceReconnecting(false);
    if (notify) setVoiceNotice("Voice session ended. The conversation transcript has been added to your chat.");
  };

  const startVoiceCall = async (mode: VoiceMode = "tutor") => {
    if (voiceStatus !== "idle") return;
    setVoiceMode(mode);
    setVoiceReconnecting(false);
    setVoiceNotice("");
    if (!navigator.mediaDevices?.getUserMedia || typeof WebSocket === "undefined" || typeof AudioContext === "undefined") {
      const message = "Live voice needs microphone access and a modern browser. You can continue with text chat.";
      setVoiceNotice(message);
      setNotice(message);
      return;
    }

    const attempt = ++callAttemptRef.current;
    endingRef.current = false;
    setupReadyRef.current = false;
    sessionHandleRef.current = "";
    liveTokenExpiresAtRef.current = 0;
    reconnectAttemptsRef.current = 0;
    microphoneInputDetectedRef.current = false;
    assistantAudioReceivedRef.current = false;
    pendingSpeechTurnRef.current = false;
    clearSpeechResponseTimer();
    speechActiveRef.current = false;
    lastSpeechAtRef.current = 0;
    microphoneNoiseFloorRef.current = 0.002;
    preRollFramesRef.current = [];
    preRollSamplesRef.current = 0;
    detectedSpeechSamplesRef.current = 0;
    liveRequestIdRef.current = "";
    setVoiceDiagnostics("Requesting microphone permission…");
    clearPendingAudio();
    startedAtRef.current = 0;
    studentTranscriptRef.current = "";
    assistantTranscriptRef.current = "";
    setVoiceTranscript("");
    setVoiceElapsed(0);
    setVoiceNotice("Preparing your secure voice session…");
    setVoiceStatus("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Automatic gain control helps built-in laptop microphones maintain a
        // usable speech level. Echo cancellation and noise suppression remain on.
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
      });
      if (attempt !== callAttemptRef.current || endingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      setVoiceDiagnostics("Microphone permission granted; preparing audio…");
      const audioContext = new AudioContext({ latencyHint: "interactive" });
      audioContextRef.current = audioContext;
      await audioContext.resume();
      setVoiceDiagnostics("Microphone is ready; requesting a secure Live session…");
      if (attempt !== callAttemptRef.current || endingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        if (audioContext.state !== "closed") void audioContext.close();
        return;
      }

      const microphone = audioContext.createMediaStreamSource(stream);
      // Capture small microphone buffers locally; completed utterances are
      // encoded and sent as a single PCM audio turn after the student pauses.
      const processor = audioContext.createScriptProcessor(1024, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      sourceRef.current = microphone;
      processorRef.current = processor;
      silentGainRef.current = silentGain;
      processor.onaudioprocess = event => {
        const socket = socketRef.current;
        if (!setupReadyRef.current || mutedRef.current || !socket || socket.readyState !== WebSocket.OPEN) return;

        const samples = event.inputBuffer.getChannelData(0);
        let energy = 0;
        for (let index = 0; index < samples.length; index++) energy += samples[index] * samples[index];
        const rms = Math.sqrt(energy / samples.length);
        const now = Date.now();
        const speechThreshold = Math.max(0.0025, Math.min(0.008, microphoneNoiseFloorRef.current * 2.1));
        const speechDetected = rms >= speechThreshold;
        const pcm = resampleTo16k(samples, audioContext.sampleRate);
        if (!pcm.length) return;

        if (!speechActiveRef.current && !speechDetected) {
          if (rms < 0.005) {
            microphoneNoiseFloorRef.current =
              microphoneNoiseFloorRef.current * 0.96 + rms * 0.04;
          }
          preRollFramesRef.current.push(pcm);
          preRollSamplesRef.current += pcm.length;
          // Keep 180 ms before speech onset so the first syllable is retained.
          while (preRollSamplesRef.current > 2880 && preRollFramesRef.current.length) {
            const first = preRollFramesRef.current[0];
            const excess = preRollSamplesRef.current - 2880;
            if (first.length <= excess) {
              preRollFramesRef.current.shift();
              preRollSamplesRef.current -= first.length;
            } else {
              preRollFramesRef.current[0] = first.subarray(excess);
              preRollSamplesRef.current -= excess;
            }
          }
          return;
        }

        if (speechDetected && !microphoneInputDetectedRef.current) {
          microphoneInputDetectedRef.current = true;
          setVoiceDiagnostics("Microphone input detected; streaming speech to Gemini Live.");
        }

        if (speechDetected && !speechActiveRef.current) {
          try {
            // With server-side activity detection disabled, explicitly mark
            // the beginning of each user turn before sending its audio frames.
            socket.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
          } catch {
            setVoiceNotice("The microphone connection paused. Please try speaking again.");
            return;
          }
          speechActiveRef.current = true;
          pendingSpeechTurnRef.current = true;
          assistantAudioReceivedRef.current = false;
          clearSpeechResponseTimer();
          pendingAudioFramesRef.current = [...preRollFramesRef.current, pcm];
          pendingAudioSamplesRef.current = preRollSamplesRef.current + pcm.length;
          detectedSpeechSamplesRef.current = pcm.length;
          preRollFramesRef.current = [];
          preRollSamplesRef.current = 0;
          setVoiceNotice("Listening…");
          lastSpeechAtRef.current = now;
        } else if (speechActiveRef.current) {
          pendingAudioFramesRef.current.push(pcm);
          pendingAudioSamplesRef.current += pcm.length;
          if (speechDetected) {
            detectedSpeechSamplesRef.current += pcm.length;
            lastSpeechAtRef.current = now;
          }
        }

        if (speechActiveRef.current) {
          try {
            flushPendingAudio(socket);
            // End a turn after 900 ms of silence. A long utterance is also
            // segmented at 45 seconds so the audio queue remains bounded.
            if ((!speechDetected && now - lastSpeechAtRef.current >= 900) ||
                pendingAudioSamplesRef.current >= 16000 * 45) {
              finishSpeechTurn(socket);
            }
          } catch {
            clearPendingAudio();
            speechActiveRef.current = false;
            pendingSpeechTurnRef.current = false;
            clearSpeechResponseTimer();
            setVoiceNotice("The audio connection paused. Check your internet connection.");
          }
        }
      };
      microphone.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      const response = await fetch("/api/learning/assistant", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          intent: "live-token",
          voiceMode: mode,
          userName,
          history: activeMessages.slice(-10).map(message => ({ role: message.role, content: message.content })),
          attachmentText: attachment?.text || "",
          sourceName: attachment?.name || materialTitle || "",
          materialId
        })
      });
      const rawTokenResponse = await response.text();
      let tokenData: { token?: string; systemInstruction?: string; error?: string; code?: string; upstreamCode?: string; upstreamMessage?: string; requestId?: string; model?: string } = {};
      try { tokenData = JSON.parse(rawTokenResponse) as typeof tokenData; } catch { /* retain a safe preview of unexpected gateway responses below */ }
      if (!response.ok || typeof tokenData.token !== "string" || !tokenData.token) {
        const serverMessage = typeof tokenData.error === "string" ? tokenData.error : "";
        const reference = [tokenData.code, tokenData.upstreamCode, tokenData.requestId ? "ref " + tokenData.requestId : ""].filter(Boolean).join(" / ");
        const upstreamMessage = typeof tokenData.upstreamMessage === "string" ? " — " + tokenData.upstreamMessage.slice(0, 180) : "";
        const htmlTitle = rawTokenResponse.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        const diagnostic = reference ? " (reference: " + reference + ")" : htmlTitle ? " (" + htmlTitle.slice(0, 100) + "; HTTP " + response.status + ")" : " (HTTP " + response.status + ")";
        throw new Error((serverMessage || "ClerkME could not obtain a Live API session.") + upstreamMessage + diagnostic);
      }
      if (attempt !== callAttemptRef.current || endingRef.current) return;
      const token = tokenData.token as string;
      setVoiceDiagnostics("Secure token issued; opening Google Live WebSocket…");
      const liveModel = typeof tokenData.model === "string" && tokenData.model.startsWith("models/")
        ? tokenData.model
        : "models/gemini-3.8-live";
      liveRequestIdRef.current = typeof tokenData.requestId === "string" ? tokenData.requestId : "";
      const voiceSystemInstruction = typeof tokenData.systemInstruction === "string" ? tokenData.systemInstruction : "";
      // Gemini's ephemeral-token guidance allows session resumption with this
      // same token for its 30-minute lifetime, even when uses is set to one.
      liveTokenExpiresAtRef.current = Date.now() + 30 * 60 * 1000;

      const connectSocket = (resumeHandle = "") => {
        if (attempt !== callAttemptRef.current || endingRef.current) return;
        setupReadyRef.current = false;
        if (resumeHandle) {
          // A partial speech turn cannot be continued on a fresh socket. Start
          // the next user utterance with a clean boundary after setup completes.
          speechActiveRef.current = false;
          lastSpeechAtRef.current = 0;
          pendingSpeechTurnRef.current = false;
          clearSpeechResponseTimer();
          clearPendingAudio();
        }
        clearConnectionTimeout();
        const endpoint = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=" + encodeURIComponent(token);
        const socket = new WebSocket(endpoint);
        socket.binaryType = "arraybuffer";
        socketRef.current = socket;
        connectionTimeoutRef.current = window.setTimeout(() => {
          if (attempt !== callAttemptRef.current || setupReadyRef.current) return;
          stopVoiceCall(false);
          const reference = liveRequestIdRef.current ? " (ref " + liveRequestIdRef.current + ")" : "";
          const message = resumeHandle
            ? "ClerkME could not restore the live session. Your completed transcript is saved; start another voice session to continue." + reference
            : "Google Live did not send setupComplete within 22 seconds. Check connectivity and retry." + reference;
          setVoiceNotice(message);
          setNotice(message);
        }, 22000);

        socket.onopen = () => {
          if (attempt !== callAttemptRef.current || endingRef.current) {
            try { socket.close(1000, "Session no longer active"); } catch {}
            return;
          }
          setVoiceDiagnostics("WebSocket connected; sending Live session setup…");
          socket.send(JSON.stringify({
            setup: {
              model: liveModel,
              ...(voiceSystemInstruction ? { systemInstruction: { parts: [{ text: voiceSystemInstruction }] } } : {}),
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              // The client uses local VAD to delimit turns. Disable server VAD
              // so explicit activityStart/activityEnd markers remain authoritative.
              realtimeInputConfig: {
                automaticActivityDetection: { disabled: true }
              },
              sessionResumption: resumeHandle ? { handle: resumeHandle } : {}
            }
          }));
        };

        socket.onmessage = async event => {
          let rawMessage = "";
          try {
            if (typeof event.data === "string") rawMessage = event.data;
            else if (event.data instanceof ArrayBuffer) rawMessage = new TextDecoder().decode(event.data);
            else if (event.data instanceof Blob) rawMessage = await event.data.text();
            else return;
          } catch {
            setVoiceNotice("Google Live sent a message ClerkME could not read. Reconnecting is recommended.");
            return;
          }
          let message: Record<string, any>;
          try { message = JSON.parse(rawMessage) as Record<string, any>; }
          catch {
            setVoiceNotice("Google Live returned an unreadable session message.");
            return;
          }
          const serverContent = message.serverContent as Record<string, any> | undefined;
          const resumptionUpdate = message.sessionResumptionUpdate ?? serverContent?.sessionResumptionUpdate;
          if (resumptionUpdate?.resumable && typeof resumptionUpdate.newHandle === "string" && resumptionUpdate.newHandle) {
            sessionHandleRef.current = resumptionUpdate.newHandle;
            reconnectAttemptsRef.current = 0;
          }

          const inputText = message.inputTranscription?.text ?? serverContent?.inputTranscription?.text;
          const outputText = message.outputTranscription?.text ?? serverContent?.outputTranscription?.text;
          if (inputText) {
            studentTranscriptRef.current = appendTranscript(studentTranscriptRef.current, String(inputText));
            setVoiceTranscript(current => appendTranscript(current, "You: " + String(inputText)));
          }
          if (outputText) {
            assistantTranscriptRef.current = appendTranscript(assistantTranscriptRef.current, String(outputText));
            setVoiceTranscript(current => appendTranscript(current, "ClerkME: " + String(outputText)));
            if (pendingSpeechTurnRef.current && !assistantAudioReceivedRef.current) {
              setVoiceNotice("ClerkME has your question and is preparing the spoken reply…");
              clearSpeechResponseTimer();
              speechResponseTimerRef.current = window.setTimeout(() => {
                speechResponseTimerRef.current = null;
                if (!pendingSpeechTurnRef.current || assistantAudioReceivedRef.current || !setupReadyRef.current || endingRef.current) return;
                pendingSpeechTurnRef.current = false;
                setVoiceDiagnostics("Google returned response text but no spoken audio.");
                setVoiceNotice("ClerkME prepared an answer but no audio arrived. The written answer is saved in the chat.");
              }, 12000);
            }
          }

          if (message.error) {
            clearConnectionTimeout();
            const serverError = typeof message.error === "string"
              ? message.error
              : String(message.error?.message || message.error?.status || "Unknown Live API error");
            const serverCode = message.error && typeof message.error === "object" && message.error.code != null
              ? " (Google error " + String(message.error.code) + ")"
              : "";
            const reference = liveRequestIdRef.current ? " · ref " + liveRequestIdRef.current : "";
            setVoiceDiagnostics("Google rejected Live setup" + serverCode + ": " + serverError.slice(0, 120));
            stopVoiceCall(false);
            const messageText = "Google Live rejected the session" + serverCode + ": " + serverError.slice(0, 180) + reference;
            setVoiceNotice(messageText);
            setNotice(messageText);
            return;
          }

          if (message.setupComplete) {
            clearConnectionTimeout();
            setupReadyRef.current = true;
            if (!startedAtRef.current) startedAtRef.current = Date.now();
            setVoiceStatus("connected");
            setVoiceReconnecting(false);
            setVoiceDiagnostics("Google Live session is ready; waiting for microphone input…");
            setVoiceNotice(resumeHandle
              ? "Reconnected securely. Your live conversation is continuing."
              : "Connected. Speak naturally; ClerkME is listening for your first question.");
            return;
          }

          if (message.goAway) {
            setVoiceNotice("Refreshing the live connection to keep your session active…");
          }
          if (!serverContent) return;
          if (serverContent.interrupted) clearPlayback();
          const parts = Array.isArray(serverContent.modelTurn?.parts) ? serverContent.modelTurn.parts : [];
          for (const part of parts) {
            const audioData = part.inlineData?.data;
            if (typeof audioData !== "string" || audioData.length < 8) continue;
            if (pendingSpeechTurnRef.current) {
              pendingSpeechTurnRef.current = false;
              clearSpeechResponseTimer();
            }
            if (!assistantAudioReceivedRef.current) {
              assistantAudioReceivedRef.current = true;
              setVoiceDiagnostics("Google Live audio received; playing the spoken response…");
            }
            setVoiceNotice("ClerkME is speaking…");
            const context = audioContextRef.current;
            if (!context || context.state === "closed") continue;
            try {
              const pcm = base64ToPcm(audioData);
              if (pcm.length < 8) continue;
              const buffer = context.createBuffer(1, pcm.length, 24000);
              const channel = buffer.getChannelData(0);
              for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
              const player = context.createBufferSource();
              player.buffer = buffer;
              player.connect(context.destination);
              const startAt = Math.max(context.currentTime + 0.025, nextPlaybackTimeRef.current);
              nextPlaybackTimeRef.current = startAt + buffer.duration;
              outputSourcesRef.current.add(player);
              player.onended = () => outputSourcesRef.current.delete(player);
              player.start(startAt);
            } catch {
              setVoiceNotice("ClerkME's audio could not be played. Check your speaker or headphone output.");
            }
          }
          if (serverContent.turnComplete) {
            speechActiveRef.current = false;
            lastSpeechAtRef.current = 0;
            pendingSpeechTurnRef.current = false;
            clearSpeechResponseTimer();
            if (!assistantAudioReceivedRef.current) {
              setVoiceDiagnostics("Google finished the turn without sending spoken audio.");
              setVoiceNotice("ClerkME finished the reply without audio. You can try another spoken question or use chat.");
            } else {
              setVoiceNotice("Connected · Listening for your next question");
            }
            commitVoiceTranscript();
          }
        };

        socket.onerror = () => {
          // Browsers omit the handshake response body from the ErrorEvent.
          // Keep the socket alive until onclose so its close code and reason
          // can identify whether this is auth, configuration, or networking.
          setVoiceDiagnostics("Browser reported a WebSocket error; checking the close code…");
          setVoiceNotice(!setupReadyRef.current
            ? "Google Live is opening the secure connection…"
            : "The connection encountered a problem. Checking whether it can recover…");
        };

        socket.onclose = event => {
          if (endingRef.current || attempt !== callAttemptRef.current) return;
          const hadCompletedSetup = setupReadyRef.current;
          clearConnectionTimeout();
          commitVoiceTranscript();
          const handle = sessionHandleRef.current;
          const canResume = Boolean(
            handle &&
            Date.now() < liveTokenExpiresAtRef.current &&
            reconnectAttemptsRef.current < 2
          );
          if (canResume) {
            reconnectAttemptsRef.current += 1;
            setupReadyRef.current = false;
            setVoiceReconnecting(true);
            setVoiceStatus("connecting");
            setVoiceNotice("Reconnecting securely to keep your session active…");
            reconnectTimerRef.current = window.setTimeout(() => {
              reconnectTimerRef.current = null;
              if (attempt === callAttemptRef.current && !endingRef.current) connectSocket(handle);
            }, 350);
            return;
          }

          const closeReason = String(event.reason || "").slice(0, 160);
          const reference = liveRequestIdRef.current ? " · ref " + liveRequestIdRef.current : "";
          const messageText = event.code === 1000 && hadCompletedSetup
            ? "Voice session ended. The transcript is saved in this conversation."
            : "Google Live closed " + (hadCompletedSetup ? "the active session" : "before setup completed") +
              " (WebSocket " + event.code + (closeReason ? ": " + closeReason : "") + ")." + reference;
          setVoiceDiagnostics("Live WebSocket closed with code " + event.code + (closeReason ? ": " + closeReason : ""));
          stopVoiceCall(false);
          setVoiceNotice(messageText);
          setNotice(messageText);
        };
      };

      connectSocket();
    } catch (error) {
      if (attempt !== callAttemptRef.current || endingRef.current) return;
      stopVoiceCall(false);
      const name = error instanceof DOMException ? error.name : "";
      const messages: Record<string, string> = {
        NotAllowedError: "Microphone permission was denied. Allow microphone access in your browser settings and retry.",
        NotFoundError: "No microphone was found. Enable a microphone, then retry.",
        NotReadableError: "The microphone is being used by another app. Close that app and retry.",
        SecurityError: "Microphone access requires HTTPS. Open ClerkME using its secure address."
      };
      const message = messages[name] || (error instanceof Error ? error.message : "ClerkME could not start the voice session.");
      setVoiceDiagnostics("Live startup failed: " + message.slice(0, 140));
      setVoiceNotice(message);
      setNotice(message);
      setVoiceStatus("idle");
    }
  };
  const toggleMute = () => {
    const next = !mutedRef.current;
    const socket = socketRef.current;
    if (next) {
      try {
        if (socket?.readyState === WebSocket.OPEN && setupReadyRef.current && speechActiveRef.current) {
          finishSpeechTurn(socket);
        }
      } catch {
        setVoiceNotice("The microphone could not be paused cleanly. End the session and reconnect.");
      }
      preRollFramesRef.current = [];
      preRollSamplesRef.current = 0;
    }
    mutedRef.current = next;
    setVoiceMuted(next);
    setVoiceNotice(next ? "Your microphone is muted." : "Microphone on. Continue speaking naturally.");
  };

  useEffect(() => () => {
    endingRef.current = true;
    callAttemptRef.current += 1;
    clearConnectionTimeout();
    clearSpeechResponseTimer();
    if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    pendingSpeechTurnRef.current = false;
    speechActiveRef.current = false;
    sessionHandleRef.current = "";
    liveTokenExpiresAtRef.current = 0;
    try { socketRef.current?.close(); } catch {}
    socketRef.current = null;
    releaseVoiceMedia();
    dictationRef.current?.stop();
  }, []);

  const suggestions = [
    { icon: "sparkles" as AskIconName, title: "Explain a difficult topic", prompt: "Teach me a difficult medical topic step by step, using clinical examples and exam pearls." },
    { icon: "clipboard-check" as AskIconName, title: "Test my knowledge", prompt: "Create five challenging single-best-answer medical questions. Ask them one at a time and wait for my answer before explaining." },
    { icon: "layers" as AskIconName, title: "Create flashcards", prompt: "Help me turn the key facts in my lecture into concise active-recall flashcards." },
    { icon: "message" as AskIconName, title: "Practise a Viva", prompt: "Act as a medical examiner and conduct a challenging Viva. Ask one question at a time and give feedback after each answer." }
  ];

  useEffect(() => {
    if (!hydrated) return;
    const field = composerRef.current;
    if (!field) return;
    field.style.height = "auto";
    const maximum = window.matchMedia("(max-width: 760px)").matches ? 116 : 150;
    const nextHeight = Math.min(Math.max(field.scrollHeight, 48), maximum);
    field.style.height = nextHeight + "px";
    field.style.overflowY = field.scrollHeight > maximum ? "auto" : "hidden";
  }, [draft, hydrated]);

  const sendAllowed = (draft.trim().length > 0 || hasContext) && !sending && !extracting;
  const currentTitle = activeThread?.title || "New conversation";

  if (!hydrated) return <section className="ask-workspace-loading"><span className="ask-loading-mark"><img src="/clerkme-mark-navy.svg" alt="" width={38} height={38} decoding="async"/></span><p>Preparing your learning assistant…</p></section>;

  return (
    <section className="ask-clerkme" aria-label="Ask ClerkME AI learning workspace">
      <div className="ask-workspace">
        <aside className={"ask-history-panel" + (showHistoryMobile ? " is-mobile-open" : "")}>
          <div className="ask-history-top">
            <div className="ask-history-brand"><span className="ask-history-brand-mark"><img src="/clerkme-mark-navy.svg" alt="" width="34" height="34" decoding="async"/></span><div><strong>Ask ClerkME</strong><small>YOUR MEDICAL LEARNING COMPANION</small></div></div>
            <button type="button" className="ask-icon-button ask-history-close" onClick={() => setShowHistoryMobile(false)} aria-label="Close conversation history"><AskIcon name="x"/></button>
          </div>
          <button type="button" className="ask-new-chat" onClick={createConversation}><span><AskIcon name="plus" size={16}/></span> New conversation</button>
          <div className="ask-history-heading"><span>RECENT CONVERSATIONS</span><span>{threads.length}</span></div>
          <div className="ask-history-list">
            {threads.map(thread => (
              <button type="button" key={thread.id} className={"ask-history-item" + (thread.id === activeThreadId ? " is-active" : "")} onClick={() => selectConversation(thread.id)}>
                <span className="ask-history-item-icon"><AskIcon name="message" size={14}/></span>
                <span><strong>{thread.title}</strong><small>{thread.messages.length ? thread.messages.length + " messages" : "New conversation"}</small></span>
              </button>
            ))}
          </div>
          <div className="ask-history-footer"><span className="ask-history-footer-mark"><AskIcon name="shield-check" size={12}/></span><span>Saved in this browser for this account</span></div>
        </aside>

        {showHistoryMobile && <button type="button" className="ask-history-scrim" onClick={() => setShowHistoryMobile(false)} aria-label="Close history"/>}

        <div className="ask-conversation">
          <header className="ask-conversation-header">
            <div className="ask-conversation-heading">
              <button type="button" className="ask-icon-button ask-mobile-history" onClick={() => setShowHistoryMobile(true)} aria-label="Open conversation history"><AskIcon name="menu" size={18}/></button>
              <span className="ask-conversation-mark"><img src="/clerkme-mark-navy.svg" alt="" width="32" height="32" decoding="async"/></span>
              <div><strong>{currentTitle}</strong><small><i/> Medical learning assistant</small></div>
            </div>
            <div className="ask-header-actions">
              <button type="button" className="ask-header-action" onClick={createConversation} aria-label="Start a new conversation" title="Start a new conversation"><AskIcon name="plus" size={16}/> <span>New chat</span></button>
              {(attachment || materialId) && <button type="button" className="ask-icon-button ask-clear-source" onClick={() => { setAttachment(null); setMaterialId(""); setMaterialTitle(""); }} aria-label="Clear attached learning source" title="Clear attached source"><AskIcon name="x" size={15}/></button>}
            </div>
          </header>

          <div className={"ask-message-scroll" + (!activeMessages.length ? " is-welcome" : "")}>
            {activeMessages.length === 0 ? (
              <div className="ask-welcome">
                <span className="ask-welcome-kicker">YOUR PERSONAL MEDICAL LEARNING SPACE</span>
                <div className="ask-welcome-orb" aria-hidden="true"><span><img src="/clerkme-mark-navy.svg" alt="" width="48" height="48" decoding="async"/></span><i/><b/></div>
                <h1>What are we learning today?</h1>
                <p>Ask a clinical question, work through a difficult concept, or upload a lecture to study from your own materials.</p>
                <div className="ask-shortcut-row" role="group" aria-label="Quick learning tools">
                  {suggestions.map(item => (
                    <button type="button" key={item.title} onClick={() => void sendMessage(item.prompt)} disabled={sending}>
                      <span><AskIcon name={item.icon} size={15}/></span><strong>{item.title}</strong>
                    </button>
                  ))}
                  <button type="button" onClick={() => void startVoiceCall("tutor")} disabled={voiceStatus !== "idle"}>
                    <span><AskIcon name="headphones" size={15}/></span><strong>Talk live</strong>
                  </button>
                  <button type="button" className="ask-shortcut-viva" onClick={() => void startVoiceCall("viva")} disabled={voiceStatus !== "idle"}>
                    <span><AskIcon name="clipboard-check" size={15}/></span><strong>Live Viva</strong>
                  </button>
                </div>
              </div>
            ) : (
              <div className="ask-message-list">
                <div className="ask-date-divider"><span>YOUR CONVERSATION</span></div>
                {activeMessages.map(message => <AssistantMessage key={message.id} message={message}/>)}
                {sending && <div className="ask-message-row is-assistant"><span className="ask-message-avatar ask-message-avatar-brand" aria-label="ClerkME"><img src="/clerkme-mark-navy.svg" alt="" width="26" height="26" decoding="async"/></span><div className="ask-thinking"><i/><i/><i/><span>ClerkME is thinking</span></div></div>}
                <div ref={messagesEndRef}/>
              </div>
            )}
          </div>

          <div className="ask-composer-area">
            {(attachment || materialId) && (
              <div className="ask-source-chip">
                <span><AskIcon name="file" size={15}/></span><span><strong>{attachment?.name || materialTitle}</strong><small>{materialId ? "Saved lecture · private library" : "Lecture text ready · " + (attachment?.characters || 0).toLocaleString() + " characters"}</small></span>
                <button type="button" onClick={() => { setAttachment(null); setMaterialId(""); setMaterialTitle(""); }} aria-label="Remove attached source"><AskIcon name="x" size={14}/></button>
              </div>
            )}
            {showMaterials && (
              <div className="ask-material-picker">
                <div><strong>Choose from My materials</strong><button type="button" onClick={() => setShowMaterials(false)} aria-label="Close materials picker"><AskIcon name="x" size={14}/></button></div>
                {materials.length ? materials.map(material => (
                  <button type="button" key={material.id} onClick={() => selectMaterial(material)}>
                    <span><AskIcon name="file" size={15}/></span><span><strong>{material.title}</strong><small>{material.unit || "Uploaded lecture"}</small></span><b><AskIcon name="plus" size={14}/></b>
                  </button>
                )) : <p>No saved lectures found. Upload a file using Attach.</p>}
              </div>
            )}
            {notice && <p className="ask-notice" role="alert">{notice}</p>}
            <form className="ask-composer" onSubmit={event => { event.preventDefault(); void sendMessage(); }}>
              <textarea
                ref={composerRef}
                rows={1}
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); }
                }}
                placeholder="Ask ClerkME anything…"
                aria-label="Ask ClerkME a question"
                aria-describedby="ask-composer-help"
                disabled={sending}
              />
              <div className="ask-composer-toolbar">
                <div className="ask-composer-tools">
                  <button type="button" className="ask-tool-button" onClick={() => fileInputRef.current?.click()} disabled={extracting} aria-label="Attach a lecture or file" title={"Attach " + STUDY_FILE_TYPES}>
                    <span><AskIcon name="paperclip" size={15}/></span><b>{extracting ? "Reading…" : "Attach"}</b>
                  </button>
                  <input ref={fileInputRef} type="file" accept={STUDY_FILE_ACCEPT} hidden onChange={event => void pickFile(event.target.files?.[0])}/>
                  <button type="button" className="ask-tool-button" onClick={() => { setShowMaterials(value => !value); setNotice(""); }} aria-expanded={showMaterials}>
                    <span><AskIcon name="folder" size={15}/></span><b>Materials</b>
                  </button>
                  <button type="button" className={"ask-tool-button ask-mic-button" + (dictating ? " is-active" : "")} onClick={startDictation} aria-label={dictating ? "Stop voice typing" : "Dictate a message"}>
                    <span><AskIcon name={dictating ? "x" : "mic"} size={15}/></span><b>{dictating ? "Stop" : "Voice"}</b>
                  </button>
                </div>
                <div className="ask-composer-submit">
                  <button type="button" className="ask-live-small" onClick={() => void startVoiceCall("tutor")} title="Start a live voice Tutor session" aria-label="Start live voice Tutor"><span><AskIcon name="headphones" size={15}/></span><b>Talk</b></button>
                  <button type="button" className="ask-live-small ask-viva-small" onClick={() => void startVoiceCall("viva")} title="Start a spoken Viva examination" aria-label="Start live Viva"><span><AskIcon name="clipboard-check" size={15}/></span><b>Viva</b></button>
                  <button type="submit" className="ask-send-button" disabled={!sendAllowed} aria-label="Send message" title="Send message"><AskIcon name="arrow-up" size={19}/></button>
                </div>
              </div>
              <div id="ask-composer-help" className="ask-composer-foot"><span>Enter to send · Shift + Enter for a new line</span><span>Check important clinical facts against current guidance.</span></div>
            </form>
          </div>
        </div>
      </div>

      {voiceStatus !== "idle" && (
        <div className="ask-voice-overlay" role="dialog" aria-modal="true" aria-label={voiceMode === "viva" ? "Viva examiner voice session" : "Live voice conversation with ClerkME"}>
          <section className="ask-voice-card">
            <div className="ask-voice-top">
              <button type="button" className="ask-icon-button" onClick={() => stopVoiceCall(true)} aria-label="Close voice conversation"><AskIcon name="x"/></button>
              <span>{voiceMode === "viva" ? "CLERKME · VIVA EXAMINER" : "CLERKME · LIVE VOICE"}</span>
              <span className="ask-voice-live-dot"/>
            </div>
            <div className={"ask-voice-orb" + (voiceStatus === "connected" ? " is-listening" : " is-connecting")}><span><img src="/clerkme-mark-navy.svg" alt="" width="64" height="64" decoding="async"/></span><i/><b/></div>
            <span className="ask-voice-state">{voiceStatus === "connecting"
              ? (voiceReconnecting ? "RESTORING LIVE CONNECTION" : "CONNECTING TO CLERKME")
              : voiceMuted ? "MICROPHONE MUTED" : voiceMode === "viva" ? "VIVA SESSION ACTIVE" : "YOU'RE TALKING TO CLERKME"}</span>
            <h2>{voiceStatus === "connecting"
              ? (voiceReconnecting ? "Reconnecting securely…" : voiceMode === "viva" ? "Preparing your Viva examiner…" : "Getting your voice session ready…")
              : (voiceMode === "viva" ? "Your Viva is under way" : "What would you like to learn?")}</h2>
            <p className="ask-voice-subtitle">{voiceStatus === "connecting"
              ? (voiceReconnecting ? "Your conversation is being preserved. Stay on this screen while ClerkME restores the audio connection." : "Allow microphone access when your browser asks.")
              : voiceMode === "viva"
                ? "Answer aloud, one question at a time. ClerkME will give examiner-style feedback after each response."
                : "Speak naturally. You can interrupt, ask follow-up questions and change direction at any time."}</p>
            {voiceStatus === "connected" && <span className="ask-voice-timer">{formatClock(voiceElapsed)}</span>}
            <div className="ask-voice-transcript" aria-live="polite">
              {voiceTranscript || (voiceStatus === "connected" ? "ClerkME is ready and listening…" : "Preparing a secure connection…")}
            </div>
            {voiceNotice && <p className="ask-voice-notice" role="status">{voiceNotice}</p>}
            <div className="ask-voice-controls">
              <button type="button" onClick={toggleMute} disabled={voiceStatus !== "connected"} className={voiceMuted ? "is-muted" : ""} aria-label={voiceMuted ? "Unmute microphone" : "Mute microphone"}><span><AskIcon name={voiceMuted ? "mic-off" : "mic"} size={17}/></span><small>{voiceMuted ? "Unmute" : "Mute"}</small></button>
              <button type="button" className="ask-voice-end" onClick={() => stopVoiceCall(true)}><span><AskIcon name="x" size={17}/></span><small>End session</small></button>
              <button type="button" onClick={() => setVoiceNotice("Use headphones if you hear an echo. Your transcript will be saved in the conversation.")}><span><AskIcon name="message" size={17}/></span><small>Help</small></button>
            </div>
            <p className="ask-voice-disclaimer">Educational support only. Do not share identifiable real-patient information.</p>
          </section>
        </div>
      )}
    </section>
  );
}
