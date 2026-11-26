"use client";

import { useEffect, useRef, useState } from "react";
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

function AssistantMessage({ message }: { message: ChatMessage }) {
  return (
    <article className={"ask-message-row " + (message.role === "user" ? "is-user" : "is-assistant")}>
      {message.role === "assistant" && <span className="ask-message-avatar" aria-hidden="true">✦</span>}
      <div className="ask-message-bubble">
        {message.attachmentName && <div className="ask-message-attachment">▤ {message.attachmentName}</div>}
        <div className="ask-message-text">{message.content}</div>
        <time>{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</time>
      </div>
    </article>
  );
}

export default function AskClerkMePanel({ userKey }: { userKey: string }) {
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
  const [voiceNotice, setVoiceNotice] = useState("");
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
  const startedAtRef = useRef(0);

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

  const stopVoiceCall = (notify = true) => {
    callAttemptRef.current += 1;
    clearConnectionTimeout();
    endingRef.current = true;
    setupReadyRef.current = false;
    const socket = socketRef.current;
    socketRef.current = null;
    try { if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "Student ended voice session"); } catch {}
    releaseVoiceMedia();
    mutedRef.current = false;
    setVoiceMuted(false);
    commitVoiceTranscript();
    setVoiceStatus("idle");
    if (notify) setVoiceNotice("Voice session ended. The conversation transcript has been added to your chat.");
  };

  const startVoiceCall = async () => {
    if (voiceStatus !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof WebSocket === "undefined" || typeof AudioContext === "undefined") {
      const message = "Live voice needs microphone access and a modern browser. You can continue with text chat.";
      setVoiceNotice(message);
      setNotice(message);
      return;
    }
    const attempt = ++callAttemptRef.current;
    endingRef.current = false;
    setupReadyRef.current = false;
    studentTranscriptRef.current = "";
    assistantTranscriptRef.current = "";
    setVoiceTranscript("");
    setVoiceElapsed(0);
    setVoiceNotice("Preparing your secure voice session…");
    setVoiceStatus("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
      });
      if (attempt !== callAttemptRef.current || endingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const audioContext = new AudioContext({ latencyHint: "interactive" });
      audioContextRef.current = audioContext;
      await audioContext.resume();

      const microphone = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      sourceRef.current = microphone;
      processorRef.current = processor;
      silentGainRef.current = silentGain;
      processor.onaudioprocess = event => {
        const socket = socketRef.current;
        if (!setupReadyRef.current || mutedRef.current || !socket || socket.readyState !== WebSocket.OPEN) return;
        const pcm = resampleTo16k(event.inputBuffer.getChannelData(0), audioContext.sampleRate);
        if (!pcm.length) return;
        try {
          socket.send(JSON.stringify({ realtimeInput: { audio: { data: pcmToBase64(pcm), mimeType: "audio/pcm;rate=16000" } } }));
        } catch {
          setVoiceNotice("The audio connection paused. Check your internet connection.");
        }
      };
      microphone.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      const response = await fetch("/api/learning/assistant", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          intent: "live-token",
          history: activeMessages.slice(-10).map(message => ({ role: message.role, content: message.content })),
          attachmentText: attachment?.text || "",
          sourceName: attachment?.name || materialTitle || "",
          materialId
        })
      });
      const tokenData = await response.json().catch(() => ({}));
      if (!response.ok || typeof tokenData.token !== "string" || !tokenData.token) throw new Error(tokenData.error || "ClerkME could not authorise the live voice session.");
      if (attempt !== callAttemptRef.current || endingRef.current) return;

      const endpoint = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=" + encodeURIComponent(tokenData.token);
      const socket = new WebSocket(endpoint);
      socketRef.current = socket;
      connectionTimeoutRef.current = window.setTimeout(() => {
        if (attempt !== callAttemptRef.current || setupReadyRef.current) return;
        stopVoiceCall(false);
        const message = "ClerkME did not finish connecting. Check your network and microphone permission, then retry.";
        setVoiceNotice(message);
        setNotice(message);
      }, 22000);

      socket.onopen = () => {
        socket.send(JSON.stringify({
          setup: {
            model: "models/gemini-3.8-live",
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: {},
            contextWindowCompression: { slidingWindow: { targetTokens: 12000 } }
          }
        }));
      };

      socket.onmessage = event => {
        if (typeof event.data !== "string") return;
        let message: Record<string, any>;
        try { message = JSON.parse(event.data) as Record<string, any>; } catch { return; }
        const serverContent = message.serverContent as Record<string, any> | undefined;
        const inputText = message.inputTranscription?.text ?? serverContent?.inputTranscription?.text;
        const outputText = message.outputTranscription?.text ?? serverContent?.outputTranscription?.text;
        if (inputText) {
          studentTranscriptRef.current = appendTranscript(studentTranscriptRef.current, String(inputText));
          setVoiceTranscript(current => appendTranscript(current, "You: " + String(inputText)));
        }
        if (outputText) {
          assistantTranscriptRef.current = appendTranscript(assistantTranscriptRef.current, String(outputText));
          setVoiceTranscript(current => appendTranscript(current, "ClerkME: " + String(outputText)));
        }
        if (message.error) {
          clearConnectionTimeout();
          stopVoiceCall(false);
          setVoiceNotice("ClerkME could not continue the voice connection. Please retry or use text chat.");
          return;
        }
        if (message.setupComplete) {
          clearConnectionTimeout();
          setupReadyRef.current = true;
          startedAtRef.current = Date.now();
          setVoiceStatus("connected");
          setVoiceNotice("Connected. Speak naturally; you can interrupt ClerkME at any time.");
          socket.send(JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: "Start the live conversation. Greet the student briefly, ask what they want to learn, and then pause for their response." }] }],
              turnComplete: true
            }
          }));
          return;
        }
        if (!serverContent) return;
        if (serverContent.interrupted) clearPlayback();
        const parts = Array.isArray(serverContent.modelTurn?.parts) ? serverContent.modelTurn.parts : [];
        for (const part of parts) {
          const audioData = part.inlineData?.data;
          if (typeof audioData !== "string" || audioData.length < 8) continue;
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
          commitVoiceTranscript();
          setVoiceNotice("Connected · Listening for your next question");
        }
      };

      socket.onerror = () => {
        if (!setupReadyRef.current) {
          clearConnectionTimeout();
          stopVoiceCall(false);
          setVoiceNotice("ClerkME could not establish the live voice call. Please retry or continue by text.");
          setNotice("The live voice connection could not be established. You can continue using text chat.");
        } else {
          setVoiceNotice("The connection encountered a problem. Try moving to a stronger internet connection.");
        }
      };

      socket.onclose = event => {
        if (endingRef.current) return;
        clearConnectionTimeout();
        commitVoiceTranscript();
        const message = event.code === 1000
          ? "Voice session ended."
          : "The voice session disconnected. Your completed transcript is saved in this conversation; please retry.";
        stopVoiceCall(false);
        setVoiceNotice(message);
        setNotice(message);
      };
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
      setVoiceNotice(message);
      setNotice(message);
      setVoiceStatus("idle");
    }
  };

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setVoiceMuted(next);
    setVoiceNotice(next ? "Your microphone is muted." : "Microphone on. Continue speaking naturally.");
  };

  useEffect(() => () => {
    endingRef.current = true;
    callAttemptRef.current += 1;
    clearConnectionTimeout();
    try { socketRef.current?.close(); } catch {}
    socketRef.current = null;
    releaseVoiceMedia();
    dictationRef.current?.stop();
  }, []);

  const suggestions = [
    { icon: "✧", title: "Explain a difficult topic", prompt: "Teach me a difficult medical topic step by step, using clinical examples and exam pearls." },
    { icon: "☑", title: "Test my knowledge", prompt: "Create five challenging single-best-answer medical questions. Ask them one at a time and wait for my answer before explaining." },
    { icon: "▤", title: "Create flashcards", prompt: "Help me turn the key facts in my lecture into concise active-recall flashcards." },
    { icon: "♧", title: "Practise a Viva", prompt: "Act as a medical examiner and conduct a challenging Viva. Ask one question at a time and give feedback after each answer." }
  ];

  const sendAllowed = (draft.trim().length > 0 || hasContext) && !sending && !extracting;
  const currentTitle = activeThread?.title || "New conversation";

  if (!hydrated) return <section className="ask-workspace-loading"><span className="ask-loading-mark">✦</span><p>Preparing your learning assistant…</p></section>;

  return (
    <section className="ask-clerkme" aria-label="Ask ClerkME AI learning workspace">
      <div className="ask-workspace">
        <aside className={"ask-history-panel" + (showHistoryMobile ? " is-mobile-open" : "")}>
          <div className="ask-history-top">
            <div className="ask-history-brand"><span>✦</span><div><strong>Ask ClerkME</strong><small>YOUR AI LEARNING COMPANION</small></div></div>
            <button type="button" className="ask-icon-button ask-history-close" onClick={() => setShowHistoryMobile(false)} aria-label="Close conversation history">×</button>
          </div>
          <button type="button" className="ask-new-chat" onClick={createConversation}><span>＋</span> New conversation</button>
          <div className="ask-history-heading"><span>RECENT CONVERSATIONS</span><span>{threads.length}</span></div>
          <div className="ask-history-list">
            {threads.map(thread => (
              <button type="button" key={thread.id} className={"ask-history-item" + (thread.id === activeThreadId ? " is-active" : "")} onClick={() => selectConversation(thread.id)}>
                <span className="ask-history-item-icon">◌</span>
                <span><strong>{thread.title}</strong><small>{thread.messages.length ? thread.messages.length + " messages" : "New conversation"}</small></span>
              </button>
            ))}
          </div>
          <div className="ask-history-footer"><span className="ask-history-footer-mark">✓</span><span>Saved in this browser for this account</span></div>
        </aside>

        {showHistoryMobile && <button type="button" className="ask-history-scrim" onClick={() => setShowHistoryMobile(false)} aria-label="Close history"/>}

        <div className="ask-conversation">
          <header className="ask-conversation-header">
            <div className="ask-conversation-heading">
              <button type="button" className="ask-icon-button ask-mobile-history" onClick={() => setShowHistoryMobile(true)} aria-label="Open conversation history">☰</button>
              <span className="ask-conversation-mark">✦</span>
              <div><strong>{currentTitle}</strong><small><i/> ClerkME learning assistant</small></div>
            </div>
            <div className="ask-header-actions">
              <button type="button" className="ask-header-action" onClick={createConversation}>＋ <span>New chat</span></button>
              <button type="button" className="ask-icon-button" onClick={() => { setAttachment(null); setMaterialId(""); setMaterialTitle(""); }} aria-label="Clear attached learning source" title="Clear attached source">⌫</button>
            </div>
          </header>

          <div className={"ask-message-scroll" + (!activeMessages.length ? " is-welcome" : "")}>
            {activeMessages.length === 0 ? (
              <div className="ask-welcome">
                <span className="ask-welcome-kicker">YOUR PERSONAL MEDICAL LEARNING SPACE</span>
                <div className="ask-welcome-orb"><span>✦</span><i/><b/></div>
                <h1>What are we learning today?</h1>
                <p>Ask a question, explore a difficult concept, or bring your lecture and learn directly from it.</p>
                <div className="ask-suggestion-grid">
                  {suggestions.map(item => (
                    <button type="button" key={item.title} onClick={() => void sendMessage(item.prompt)} disabled={sending}>
                      <span>{item.icon}</span><strong>{item.title}</strong><b>→</b>
                    </button>
                  ))}
                </div>
                <button type="button" className="ask-live-feature" onClick={() => void startVoiceCall()}>
                  <span className="ask-live-feature-icon">♫</span>
                  <span><strong>Talk to ClerkME</strong><small>Start a natural, two-way voice conversation</small></span>
                  <b>Start call <i>→</i></b>
                </button>
              </div>
            ) : (
              <div className="ask-message-list">
                <div className="ask-date-divider"><span>YOUR CONVERSATION</span></div>
                {activeMessages.map(message => <AssistantMessage key={message.id} message={message}/>)}
                {sending && <div className="ask-message-row is-assistant"><span className="ask-message-avatar">✦</span><div className="ask-thinking"><i/><i/><i/><span>ClerkME is thinking</span></div></div>}
                <div ref={messagesEndRef}/>
              </div>
            )}
          </div>

          <div className="ask-composer-area">
            {(attachment || materialId) && (
              <div className="ask-source-chip">
                <span>▤</span><span><strong>{attachment?.name || materialTitle}</strong><small>{materialId ? "Saved lecture · private library" : "Lecture text ready · " + (attachment?.characters || 0).toLocaleString() + " characters"}</small></span>
                <button type="button" onClick={() => { setAttachment(null); setMaterialId(""); setMaterialTitle(""); }} aria-label="Remove attached source">×</button>
              </div>
            )}
            {showMaterials && (
              <div className="ask-material-picker">
                <div><strong>Choose from My materials</strong><button type="button" onClick={() => setShowMaterials(false)}>×</button></div>
                {materials.length ? materials.map(material => (
                  <button type="button" key={material.id} onClick={() => selectMaterial(material)}>
                    <span>▤</span><span><strong>{material.title}</strong><small>{material.unit || "Uploaded lecture"}</small></span><b>＋</b>
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
                disabled={sending}
              />
              <div className="ask-composer-toolbar">
                <div className="ask-composer-tools">
                  <button type="button" className="ask-tool-button" onClick={() => fileInputRef.current?.click()} disabled={extracting} aria-label="Attach a lecture or file" title={"Attach " + STUDY_FILE_TYPES}>
                    <span>＋</span><b>{extracting ? "Reading…" : "Attach"}</b>
                  </button>
                  <input ref={fileInputRef} type="file" accept={STUDY_FILE_ACCEPT} hidden onChange={event => void pickFile(event.target.files?.[0])}/>
                  <button type="button" className="ask-tool-button" onClick={() => { setShowMaterials(value => !value); setNotice(""); }} aria-expanded={showMaterials}>
                    <span>▤</span><b>My materials</b>
                  </button>
                  <button type="button" className={"ask-tool-button ask-mic-button" + (dictating ? " is-active" : "")} onClick={startDictation} aria-label={dictating ? "Stop voice typing" : "Dictate a message"}>
                    <span>{dictating ? "■" : "♩"}</span><b>{dictating ? "Stop" : "Voice input"}</b>
                  </button>
                </div>
                <div className="ask-composer-submit">
                  <button type="button" className="ask-live-small" onClick={() => void startVoiceCall()} title="Start a live voice conversation"><span>♫</span><b>Talk live</b></button>
                  <button type="submit" className="ask-send-button" disabled={!sendAllowed} aria-label="Send message">↑</button>
                </div>
              </div>
              <div className="ask-composer-foot"><span>Enter to send · Shift + Enter for a new line</span><span>Check important clinical facts against current guidance.</span></div>
            </form>
          </div>
        </div>
      </div>

      {voiceStatus !== "idle" && (
        <div className="ask-voice-overlay" role="dialog" aria-modal="true" aria-label="Live voice conversation with ClerkME">
          <section className="ask-voice-card">
            <div className="ask-voice-top">
              <button type="button" className="ask-icon-button" onClick={() => stopVoiceCall(true)} aria-label="Close voice conversation">×</button>
              <span>CLERKME · LIVE VOICE</span>
              <span className="ask-voice-live-dot"/>
            </div>
            <div className={"ask-voice-orb" + (voiceStatus === "connected" ? " is-listening" : " is-connecting")}><span>✦</span><i/><b/></div>
            <span className="ask-voice-state">{voiceStatus === "connecting" ? "CONNECTING TO CLERKME" : voiceMuted ? "MICROPHONE MUTED" : "YOU'RE TALKING TO CLERKME"}</span>
            <h2>{voiceStatus === "connecting" ? "Getting your voice session ready…" : "What would you like to learn?"}</h2>
            <p className="ask-voice-subtitle">{voiceStatus === "connecting" ? "Allow microphone access when your browser asks." : "Speak naturally. You can interrupt, ask follow-up questions and change direction at any time."}</p>
            {voiceStatus === "connected" && <span className="ask-voice-timer">{formatClock(voiceElapsed)}</span>}
            <div className="ask-voice-transcript" aria-live="polite">
              {voiceTranscript || (voiceStatus === "connected" ? "ClerkME is ready and listening…" : "Preparing a secure connection…")}
            </div>
            {voiceNotice && <p className="ask-voice-notice" role="status">{voiceNotice}</p>}
            <div className="ask-voice-controls">
              <button type="button" onClick={toggleMute} disabled={voiceStatus !== "connected"} className={voiceMuted ? "is-muted" : ""}><span>{voiceMuted ? "◌" : "♩"}</span><small>{voiceMuted ? "Unmute" : "Mute"}</small></button>
              <button type="button" className="ask-voice-end" onClick={() => stopVoiceCall(true)}><span>■</span><small>End session</small></button>
              <button type="button" onClick={() => setVoiceNotice("Use headphones if you hear an echo. Your transcript will be saved in the conversation.")}><span>ⓘ</span><small>Help</small></button>
            </div>
            <p className="ask-voice-disclaimer">Educational support only. Do not share identifiable real-patient information.</p>
          </section>
        </div>
      )}
    </section>
  );
}
